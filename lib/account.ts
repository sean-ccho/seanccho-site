import type { Dict } from "./i18n";
import { appendRow, clearRanges, deleteRow, readValues, sheetIdOf, writeValues } from "./sheets";

// 구글 시트 '내계좌' 탭 — Project_1 src/screener/portfolio_report.py 가 매일 밤 읽고 분석 컬럼을 채운다.
// 웹은 입력 컬럼(INPUT_FIELDS)만 쓰고, 컬럼 위치는 머리글 이름으로 찾는다.

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
] as const;

export type InputKey = (typeof INPUT_FIELDS)[number]["key"];
export type AccountInput = Record<InputKey, string>;

export type AccountRow = {
  row: number; // 시트 줄 번호 (1부터, 머리글이 1)
  input: AccountInput; // 시트에 적힌 그대로 (글자)
  buyPrice: number | null;
  shares: number | null;
  price: number | null; // 분석 컬럼 '현재가'
  rsiDaily: string; // '[Daily] RSI'
  updated: string; // '업데이트'
};

/** 그 사이 시트가 바뀌어 고치려던 줄이 다른 종목이 됐을 때. */
export class RowChangedError extends Error {}

const rng = (a1: string) => `'${ACCOUNT_TAB}'!${a1}`;

/** 0 → A, 25 → Z, 26 → AA. */
export function colLetter(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function text(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = text(v).replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 머리글 + 종목 줄 (티커가 빈 줄은 건너뛴다). */
export function parseAccount(values: unknown[][]): { headers: string[]; rows: AccountRow[] } {
  const headers = (values[0] ?? []).map(text);
  const col = (h: string) => headers.indexOf(h);
  const rows: AccountRow[] = [];
  values.slice(1).forEach((r, i) => {
    const get = (h: string) => (col(h) >= 0 ? r[col(h)] : undefined);
    const input = Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, text(get(f.header))])) as AccountInput;
    if (!input.ticker) return;
    rows.push({
      row: i + 2,
      input,
      buyPrice: toNum(get("매수가")),
      shares: toNum(get("수량")),
      price: toNum(get("현재가")),
      rsiDaily: text(get("[Daily] RSI")),
      updated: text(get("업데이트")),
    });
  });
  return { headers, rows };
}

export async function readAccount(): Promise<{ headers: string[]; rows: AccountRow[] }> {
  return parseAccount(await readValues(rng("A1:AZ")));
}

const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/;
const MAX_LEN: Partial<Record<InputKey, number>> = { company: 80, exchange: 20, sector: 60, memo: 300 };

/** 폼 → 검사한 입력. 틀리면 화면 언어로 된 설명. */
export function parseInput(form: FormData, t: Dict): { input: AccountInput } | { error: string } {
  const raw = (k: InputKey) => text(form.get(k));
  const input = Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, raw(f.key)])) as AccountInput;
  input.ticker = input.ticker.toUpperCase();
  input.exchange = input.exchange.toUpperCase();
  if (!TICKER_RE.test(input.ticker)) return { error: t.account.errTicker };
  for (const [key, label] of [["buyPrice", t.account.colBuyPrice], ["shares", t.account.colShares]] as const) {
    const v = input[key].replace(/,/g, "");
    if (v && !(Number.isFinite(Number(v)) && Number(v) >= 0)) return { error: t.account.errNumber(label) };
    input[key] = v;
  }
  if (input.buyDate) {
    const d = new Date(`${input.buyDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.buyDate) || Number.isNaN(d.getTime())) return { error: t.account.errDate };
  }
  const labels: Partial<Record<InputKey, string>> = {
    company: t.account.colCompany,
    exchange: t.account.colExchange,
    sector: t.account.colSector,
    memo: t.account.colMemo,
  };
  for (const [key, max] of Object.entries(MAX_LEN) as [InputKey, number][]) {
    if (input[key].length > max) return { error: t.account.errTooLong(labels[key] ?? key) };
  }
  return { input };
}

/** 시트에 쓸 값 — 숫자는 숫자로, 글자가 = + - @ 로 시작하면 수식이 되지 않게 ' 를 붙인다. */
function cell(key: InputKey, v: string): string | number {
  if (!v) return "";
  if (key === "buyPrice" || key === "shares") return Number(v);
  if (key !== "buyDate" && /^[=+\-@]/.test(v)) return `'${v}`;
  return v;
}

async function headersOrThrow(): Promise<string[]> {
  const headers = ((await readValues(rng("A1:AZ1")))[0] ?? []).map(text);
  if (!headers.includes("티커")) throw new Error(`'${ACCOUNT_TAB}' header row not found`);
  return headers;
}

/** 줄이 아직 그 종목인지 확인 (아니면 RowChangedError). */
async function checkRow(row: number, expectTicker: string): Promise<{ headers: string[]; current: AccountRow }> {
  const { headers, rows } = await readAccount();
  const current = rows.find((r) => r.row === row);
  if (!current || current.input.ticker.toUpperCase() !== expectTicker.toUpperCase()) throw new RowChangedError();
  return { headers, current };
}

export async function addRow(input: AccountInput): Promise<void> {
  const headers = await headersOrThrow();
  const values = headers.map((h) => {
    const f = INPUT_FIELDS.find((x) => x.header === h);
    return f ? cell(f.key, input[f.key]) : "";
  });
  await appendRow(rng("A1"), values);
}

export async function updateRow(row: number, expectTicker: string, input: AccountInput): Promise<void> {
  const { headers, current } = await checkRow(row, expectTicker);
  const data = INPUT_FIELDS.filter((f) => headers.includes(f.header)).map((f) => ({
    range: rng(`${colLetter(headers.indexOf(f.header))}${row}`),
    values: [[cell(f.key, input[f.key])]],
  }));
  await writeValues(data);
  // 티커가 바뀌면 옛 종목의 분석 값(현재가·RSI…)은 지운다 — 밤 파이프라인이 새로 채운다
  if (input.ticker !== current.input.ticker.toUpperCase()) {
    const inputHeaders = new Set<string>(INPUT_FIELDS.map((f) => f.header));
    const analysis = headers.map((h, i) => ({ h, i })).filter(({ h }) => h && !inputHeaders.has(h));
    if (analysis.length) await clearRanges(analysis.map(({ i }) => rng(`${colLetter(i)}${row}`)));
  }
}

export async function removeRow(row: number, expectTicker: string): Promise<void> {
  await checkRow(row, expectTicker);
  const id = await sheetIdOf(ACCOUNT_TAB);
  if (id == null) throw new Error(`'${ACCOUNT_TAB}' tab not found`);
  await deleteRow(id, row);
}
