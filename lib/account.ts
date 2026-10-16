import type { Dict } from "./i18n";
import { JOURNAL_FIELDS, JOURNAL_TAB, journalCell } from "./journal";
import { clearRanges, deleteRow, readValues, sheetIdOf, writeValues } from "./sheets";
import { addTabRow, colLetter, ensureTab, normDate, RowChangedError, safeText, text, toNum } from "./tab";

// 구글 시트 '내계좌' 탭 — Project_1 src/screener/portfolio_report.py 가 매일 밤 읽고 분석 컬럼을 채운다.
// 웹은 입력 컬럼(INPUT_FIELDS)만 쓰고, 컬럼 위치는 머리글 이름으로 찾는다 (빠진 머리글은 오른쪽 끝에 붙인다).

export { RowChangedError };

export const ACCOUNT_TAB = "내계좌";

export const INPUT_FIELDS = [
  { key: "ticker", header: "티커" },
  { key: "company", header: "회사명" },
  { key: "exchange", header: "거래소" },
  { key: "sector", header: "섹터" },
  { key: "buyPrice", header: "매수가" },
  { key: "shares", header: "수량" },
  { key: "buyDate", header: "매수일" },
  { key: "memo", header: "메모" },
  // 2026-10-16 — 손절가는 밤 알림 메일(손절가 아래·근접), 매수이유는 매매일지 성적(이유별 SPY 대비)에 쓴다
  { key: "stop", header: "손절가" },
  { key: "reason", header: "매수이유" },
] as const;

export type InputKey = (typeof INPUT_FIELDS)[number]["key"];
export type AccountInput = Record<InputKey, string>;

export type AccountRow = {
  row: number; // 시트 줄 번호 (1부터, 머리글이 1)
  input: AccountInput; // 시트에 적힌 그대로 (글자, 날짜는 YYYY-MM-DD 로 맞춤)
  buyPrice: number | null;
  shares: number | null;
  stop: number | null;
  price: number | null; // 분석 컬럼 '현재가'
  rsiDaily: string; // '[Daily] RSI'
  updated: string; // '업데이트'
  // 리스크 컬럼 (밤 파이프라인, 2026-10-16 부터)
  atrPct: number | null; // 'ATR%' (0.031 = 3.1%)
  beta: number | null; // '베타(1년)'
  avgCorr: number | null; // '평균상관'
  earnings: string; // '실적일' YYYY-MM-DD
};

const rng = (a1: string) => `'${ACCOUNT_TAB}'!${a1}`;
const NUM_KEYS: InputKey[] = ["buyPrice", "shares", "stop"];

/** 머리글 + 종목 줄 (티커가 빈 줄은 건너뛴다). */
export function parseAccount(values: unknown[][]): { headers: string[]; rows: AccountRow[] } {
  const headers = (values[0] ?? []).map(text);
  const col = (h: string) => headers.indexOf(h);
  const rows: AccountRow[] = [];
  values.slice(1).forEach((r, i) => {
    const get = (h: string) => (col(h) >= 0 ? r[col(h)] : undefined);
    const input = Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, text(get(f.header))])) as AccountInput;
    if (!input.ticker) return;
    input.buyDate = normDate(input.buyDate);
    rows.push({
      row: i + 2,
      input,
      buyPrice: toNum(get("매수가")),
      shares: toNum(get("수량")),
      stop: toNum(get("손절가")),
      price: toNum(get("현재가")),
      rsiDaily: text(get("[Daily] RSI")),
      updated: text(get("업데이트")),
      atrPct: toNum(get("ATR%")),
      beta: toNum(get("베타(1년)")),
      avgCorr: toNum(get("평균상관")),
      earnings: normDate(get("실적일")),
    });
  });
  return { headers, rows };
}

export async function readAccount(): Promise<{ headers: string[]; rows: AccountRow[] }> {
  return parseAccount(await readValues(rng("A1:AZ")));
}

const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LEN: Partial<Record<InputKey, number>> = { company: 80, exchange: 20, sector: 60, memo: 300, reason: 40 };

export function validTicker(s: string): boolean {
  return TICKER_RE.test(s);
}

export function validDate(s: string): boolean {
  return DATE_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
}

/** 폼 → 검사한 입력. 틀리면 화면 언어로 된 설명. */
export function parseInput(form: FormData, t: Dict): { input: AccountInput } | { error: string } {
  const raw = (k: InputKey) => text(form.get(k));
  const input = Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, raw(f.key)])) as AccountInput;
  input.ticker = input.ticker.toUpperCase();
  input.exchange = input.exchange.toUpperCase();
  if (!validTicker(input.ticker)) return { error: t.account.errTicker };
  const numLabels: Record<string, string> = { buyPrice: t.account.colBuyPrice, shares: t.account.colShares, stop: t.account.colStop };
  for (const key of NUM_KEYS) {
    const v = input[key].replace(/[$,]/g, "");
    if (v && !(Number.isFinite(Number(v)) && Number(v) >= 0)) return { error: t.account.errNumber(numLabels[key]) };
    input[key] = v;
  }
  if (input.buyDate && !validDate(input.buyDate)) return { error: t.account.errDate };
  const labels: Partial<Record<InputKey, string>> = {
    company: t.account.colCompany,
    exchange: t.account.colExchange,
    sector: t.account.colSector,
    memo: t.account.colMemo,
    reason: t.account.colReason,
  };
  for (const [key, max] of Object.entries(MAX_LEN) as [InputKey, number][]) {
    if (input[key].length > max) return { error: t.account.errTooLong(labels[key] ?? key) };
  }
  return { input };
}

/** 시트에 쓸 값 — 숫자는 숫자로, 글자가 = + - @ 로 시작하면 수식이 되지 않게 ' 를 붙인다. */
function cell(key: InputKey, v: string): string | number {
  if (!v) return "";
  if (NUM_KEYS.includes(key)) return Number(v);
  if (key === "buyDate") return v;
  return safeText(v);
}

const inputHeaders = () => INPUT_FIELDS.map((f) => f.header);

/** 줄이 아직 그 종목인지 확인 (아니면 RowChangedError). */
async function checkRow(row: number, expectTicker: string): Promise<{ headers: string[]; current: AccountRow }> {
  const { headers, rows } = await readAccount();
  const current = rows.find((r) => r.row === row);
  if (!current || current.input.ticker.toUpperCase() !== expectTicker.toUpperCase()) throw new RowChangedError();
  return { headers, current };
}

export async function addRow(input: AccountInput): Promise<void> {
  await addTabRow(ACCOUNT_TAB, INPUT_FIELDS, input, cell);
}

export async function updateRow(row: number, expectTicker: string, input: AccountInput): Promise<void> {
  const { current } = await checkRow(row, expectTicker);
  const headers = await ensureTab(ACCOUNT_TAB, inputHeaders());
  const data = INPUT_FIELDS.filter((f) => headers.includes(f.header)).map((f) => ({
    range: rng(`${colLetter(headers.indexOf(f.header))}${row}`),
    values: [[cell(f.key, input[f.key])]],
  }));
  await writeValues(data);
  // 티커가 바뀌면 옛 종목의 분석 값(현재가·RSI…)은 지운다 — 밤 파이프라인이 새로 채운다
  if (input.ticker !== current.input.ticker.toUpperCase()) {
    const inputSet = new Set<string>(inputHeaders());
    const analysis = headers.map((h, i) => ({ h, i })).filter(({ h }) => h && !inputSet.has(h));
    if (analysis.length) await clearRanges(analysis.map(({ i }) => rng(`${colLetter(i)}${row}`)));
  }
}

export async function removeRow(row: number, expectTicker: string): Promise<void> {
  await checkRow(row, expectTicker);
  const id = await sheetIdOf(ACCOUNT_TAB);
  if (id == null) throw new Error(`'${ACCOUNT_TAB}' tab not found`);
  await deleteRow(id, row);
}

export type SellInput = { sellDate: string; sellPrice: string; shares: string };

/** 매도 폼 검사 — 수량은 보유 수량 이하. */
export function parseSell(form: FormData, held: number | null, t: Dict): { sell: SellInput } | { error: string } {
  const sellDate = text(form.get("sellDate"));
  const sellPrice = text(form.get("sellPrice")).replace(/[$,]/g, "");
  const shares = text(form.get("sellShares")).replace(/,/g, "");
  if (!validDate(sellDate)) return { error: t.journal.errSellDate };
  if (!(Number(sellPrice) > 0)) return { error: t.account.errNumber(t.journal.colSellPrice) };
  const n = Number(shares);
  if (!(n > 0) || (held != null && n > held + 1e-9)) return { error: t.journal.errShares };
  return { sell: { sellDate, sellPrice, shares } };
}

/**
 * 보유 종목을 판다 — 매매일지에 한 줄을 붙이고, 내계좌는 남은 수량으로 줄이거나 (다 팔면) 줄을 지운다.
 * 매매일지 쓰기가 먼저다: 내계좌 수정이 실패해도 기록은 남고, 화면에 오류가 보인다.
 */
export async function sellRow(row: number, expectTicker: string, sellForm: FormData, t: Dict): Promise<{ error?: string }> {
  const { headers, current } = await checkRow(row, expectTicker);
  const parsed = parseSell(sellForm, current.shares, t);
  if ("error" in parsed) return { error: parsed.error };
  const { sell } = parsed;
  const i = current.input;
  await addTabRow(JOURNAL_TAB, JOURNAL_FIELDS, {
    ticker: i.ticker,
    company: i.company,
    buyDate: i.buyDate,
    buyPrice: current.buyPrice != null ? String(current.buyPrice) : "",
    shares: sell.shares,
    sellDate: sell.sellDate,
    sellPrice: sell.sellPrice,
    reason: i.reason,
    memo: i.memo,
  }, journalCell);
  const left = current.shares != null ? current.shares - Number(sell.shares) : 0;
  if (left > 1e-9) {
    const c = headers.indexOf("수량");
    if (c >= 0) await writeValues([{ range: rng(`${colLetter(c)}${row}`), values: [[Number(left.toFixed(6))]] }]);
  } else {
    const id = await sheetIdOf(ACCOUNT_TAB);
    if (id == null) throw new Error(`'${ACCOUNT_TAB}' tab not found`);
    await deleteRow(id, row);
  }
  return {};
}
