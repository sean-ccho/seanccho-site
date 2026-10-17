import type { Dict } from "./i18n";
import { appendRow, clearRanges, deleteRow, readValues, sheetIdOf, writeValues } from "./sheets";
import { addTabRow, colLetter, ensureTab, normDate, RowChangedError, safeText, text, toNum } from "./tab";

// 구글 시트 '내계좌' 탭 — 한 줄 = 거래 하나 (2026-10-16 매매일지와 합침, Logan 탭처럼).
// 매도일이 비어 있으면 보유 중, 있으면 매도 완료. Project_1 src/screener/portfolio_report.py 가 매일 밤 보유 중인 줄의
// 분석 컬럼을 채우고 '상태' 칸을 매도일 기준으로 맞춘다. 웹은 입력 컬럼(INPUT_FIELDS)만 쓰고, 위치는 머리글 이름으로 찾는다.

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
  // 2026-10-16 — 손절가는 밤 알림 메일(손절가 아래·근접), 매수이유는 매수이유별 성적(SPY 대비)에 쓴다
  { key: "stop", header: "손절가" },
  { key: "reason", header: "매수이유" },
  // 판 거래 — 매도일이 있으면 매도 완료. 상태는 쓸 때 매도일로 정한다 (밤 파이프라인도 맞춘다)
  { key: "sellDate", header: "매도일" },
  { key: "sellPrice", header: "매도가" },
  { key: "status", header: "상태" },
] as const;

export const STATUS_OPEN = "보유 중";
export const STATUS_CLOSED = "매도 완료";

export type InputKey = (typeof INPUT_FIELDS)[number]["key"];
export type AccountInput = Record<InputKey, string>;

export type AccountRow = {
  row: number; // 시트 줄 번호 (1부터, 머리글이 1)
  input: AccountInput; // 시트에 적힌 그대로 (글자, 날짜는 YYYY-MM-DD 로 맞춤)
  buyPrice: number | null;
  shares: number | null;
  stop: number | null;
  sellPrice: number | null; // 판 거래면 매도가
  closed: boolean; // 매도일이 있으면 true
  price: number | null; // 분석 컬럼 '현재가'
  rsiDaily: string; // '[Daily] RSI'
  updated: string; // '업데이트'
  // 리스크 컬럼 (밤 파이프라인, 2026-10-16 부터)
  atrPct: number | null; // 'ATR%' (0.031 = 3.1%)
  beta: number | null; // '베타(1년)'
  avgCorr: number | null; // '평균상관'
  earnings: string; // '실적일' YYYY-MM-DD
  secFlags: string; // '공시' — SEC 🔴·🟠 경고 한 줄 (밤 파이프라인, 2026-10-17 부터)
};

const rng = (a1: string) => `'${ACCOUNT_TAB}'!${a1}`;
const NUM_KEYS: InputKey[] = ["buyPrice", "shares", "stop", "sellPrice"];

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
    input.sellDate = normDate(input.sellDate);
    rows.push({
      row: i + 2,
      input,
      buyPrice: toNum(get("매수가")),
      shares: toNum(get("수량")),
      stop: toNum(get("손절가")),
      sellPrice: toNum(get("매도가")),
      closed: Boolean(input.sellDate),
      price: toNum(get("현재가")),
      rsiDaily: text(get("[Daily] RSI")),
      updated: text(get("업데이트")),
      atrPct: toNum(get("ATR%")),
      beta: toNum(get("베타(1년)")),
      avgCorr: toNum(get("평균상관")),
      earnings: normDate(get("실적일")),
      secFlags: text(get("공시")),
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
  const numLabels: Record<string, string> = {
    buyPrice: t.account.colBuyPrice, shares: t.account.colShares, stop: t.account.colStop, sellPrice: t.journal.colSellPrice,
  };
  for (const key of NUM_KEYS) {
    const v = input[key].replace(/[$,]/g, "");
    if (v && !(Number.isFinite(Number(v)) && Number(v) >= 0)) return { error: t.account.errNumber(numLabels[key]) };
    input[key] = v;
  }
  if (input.buyDate && !validDate(input.buyDate)) return { error: t.account.errDate };
  // 판 거래: 매도일·매도가는 둘 다 있거나 둘 다 없거나. 매도일은 매수일보다 빠를 수 없다
  if (input.sellDate || input.sellPrice) {
    if (!validDate(input.sellDate)) return { error: t.journal.errSellDate };
    if (!(Number(input.sellPrice) > 0)) return { error: t.journal.errPositive(t.journal.colSellPrice) };
    if (input.buyDate && input.sellDate < input.buyDate) return { error: t.journal.errOrder };
  }
  input.status = input.sellDate ? STATUS_CLOSED : STATUS_OPEN;
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
  if (key === "buyDate" || key === "sellDate") return v;
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
 * 보유 중인 줄을 판다 — 같은 줄에 매도일·매도가를 채워 '매도 완료'로 (Logan 탭처럼 한 줄 = 거래 하나).
 * 일부만 팔면 원래 줄은 남은 수량으로 보유 중, 판 수량은 같은 내용의 새 줄(매도 완료)로 붙인다.
 */
export async function sellRow(row: number, expectTicker: string, sellForm: FormData, t: Dict): Promise<{ error?: string }> {
  const { current } = await checkRow(row, expectTicker);
  if (current.closed) return { error: t.account.errAlreadySold };
  const parsed = parseSell(sellForm, current.shares, t);
  if ("error" in parsed) return { error: parsed.error };
  const { sell } = parsed;
  if (current.input.buyDate && sell.sellDate < current.input.buyDate) return { error: t.journal.errOrder };
  const sold = Number(sell.shares);
  const left = current.shares != null ? current.shares - sold : 0;
  const full = await ensureTab(ACCOUNT_TAB, inputHeaders());
  const cellAt = (h: string, v: unknown) => ({ range: rng(`${colLetter(full.indexOf(h))}${row}`), values: [[v]] });
  if (left > 1e-9) {
    // 판 만큼 새 줄 (입력 칸은 그대로 복사, 수량·매도일·매도가·상태만 바꿔서)
    const input: AccountInput = { ...current.input, shares: String(sold), sellDate: sell.sellDate, sellPrice: sell.sellPrice,
      status: STATUS_CLOSED };
    await appendRow(rng("A1"), full.map((h) => {
      const f = INPUT_FIELDS.find((x) => x.header === h);
      return f ? cell(f.key, input[f.key]) : "";
    }));
    // 원래 줄은 남은 수량으로 보유 중 (상태 칸이 생기기 전 줄은 비어 있으니 같이 쓴다)
    await writeValues([cellAt("수량", Number(left.toFixed(6))), cellAt("상태", STATUS_OPEN)]);
    return {};
  }
  await writeValues([
    cellAt("매도일", sell.sellDate),
    cellAt("매도가", Number(sell.sellPrice)),
    cellAt("상태", STATUS_CLOSED),
  ]);
  return {};
}
