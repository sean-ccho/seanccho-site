import { addSheet, appendColumns, appendRow, deleteRow, readValues, SheetsError, sheetProps, writeValues } from "./sheets";

// 구글 시트 탭 공통 — 열은 머리글 이름으로 찾고, 탭·머리글이 없으면 만든다 (빠진 머리글은 오른쪽 끝에).
// Project_1 의 portfolio_report.py 도 같은 방식 (이름으로 찾기 · 끝에 붙이기) 이라 서로 열을 덮어쓰지 않는다.

export type Field<K extends string = string> = { key: K; header: string };

/** 그 사이 시트가 바뀌어 고치려던 줄이 다른 종목이 됐을 때. */
export class RowChangedError extends Error {}

export const rng = (tab: string, a1: string) => `'${tab}'!${a1}`;

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

export function text(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

export function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = text(v).replace(/[$,\s]/g, "");
  if (!s) return null;
  const pctSign = s.endsWith("%");
  const n = Number(pctSign ? s.slice(0, -1) : s);
  if (!Number.isFinite(n)) return null;
  return pctSign ? n / 100 : n;
}

/** 시트가 보여 주는 날짜 글자 → 'YYYY-MM-DD'. '2026-10-15' · '2026. 10. 15' · '2026/10/15' · '10/15/2026' 을 읽는다. */
export function normDate(v: unknown): string {
  const s = text(v);
  if (!s) return "";
  let m = s.match(/^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\.?/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return s;
}

export function trimHeaders(row: unknown[] | undefined): string[] {
  const h = (row ?? []).map(text);
  while (h.length && !h[h.length - 1]) h.pop();
  return h;
}

/**
 * 탭이 없으면 머리글과 함께 만들고, 있으면 빠진 머리글만 오른쪽 끝에 붙인다. 붙인 뒤의 머리글을 돌려준다.
 * 이미 있는 열은 옮기지 않는다 (밤 파이프라인·사람이 쓰는 열을 덮어쓰지 않게).
 */
export async function ensureTab(tab: string, headers: string[]): Promise<string[]> {
  const props = await sheetProps(tab);
  if (!props) {
    await addSheet(tab, Math.max(headers.length, 26));
    await writeValues([{ range: rng(tab, "A1"), values: [headers] }]);
    return [...headers];
  }
  const current = trimHeaders((await readValues(rng(tab, "1:1")))[0]);
  const missing = headers.filter((h) => !current.includes(h));
  if (!missing.length) return current;
  const need = current.length + missing.length;
  const have = props.gridProperties?.columnCount ?? 26;
  if (have < need) await appendColumns(props.sheetId, need - have);
  await writeValues([{ range: rng(tab, `${colLetter(current.length)}1`), values: [missing] }]);
  return current.concat(missing);
}

export type TabRow<K extends string> = {
  row: number; // 시트 줄 번호 (1부터, 머리글이 1)
  input: Record<K, string>; // 입력 칸 (글자)
  cells: Record<string, unknown>; // 머리글 → 값 (분석 칸 포함)
};

/** 탭 전체 → 머리글 + 티커가 있는 줄. 탭이 없으면 빈 표. */
export async function readTab<K extends string>(tab: string, fields: readonly Field<K>[], tickerKey: K):
  Promise<{ headers: string[]; rows: TabRow<K>[]; exists: boolean }> {
  let values: unknown[][];
  try {
    values = await readValues(rng(tab, "A1:AZ"));
  } catch (err) {
    // 없는 탭 범위 → 400 'Unable to parse range'
    if (err instanceof SheetsError && err.status === 400 && /parse range/i.test(err.message)) {
      return { headers: [], rows: [], exists: false };
    }
    throw err;
  }
  const headers = (values[0] ?? []).map(text);
  const rows: TabRow<K>[] = [];
  values.slice(1).forEach((r, i) => {
    const cells: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      if (h) cells[h] = r[j];
    });
    const input = Object.fromEntries(fields.map((f) => [f.key, text(cells[f.header])])) as Record<K, string>;
    if (!input[tickerKey]) return;
    rows.push({ row: i + 2, input, cells });
  });
  return { headers, rows, exists: true };
}

export type CellFn<K extends string> = (key: K, v: string) => string | number;

/** 글자가 = + - @ 로 시작하면 수식이 되지 않게 ' 를 붙인다. */
export function safeText(v: string): string {
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

export async function addTabRow<K extends string>(tab: string, fields: readonly Field<K>[], input: Record<K, string>,
  cell: CellFn<K>): Promise<void> {
  const headers = await ensureTab(tab, fields.map((f) => f.header));
  const values = headers.map((h) => {
    const f = fields.find((x) => x.header === h);
    return f ? cell(f.key, input[f.key] ?? "") : "";
  });
  await appendRow(rng(tab, "A1"), values);
}

/** 줄이 아직 그 종목인지 확인 (아니면 RowChangedError). */
export async function checkTabRow<K extends string>(tab: string, fields: readonly Field<K>[], tickerKey: K, row: number,
  expectTicker: string): Promise<{ headers: string[]; current: TabRow<K> }> {
  const { headers, rows } = await readTab(tab, fields, tickerKey);
  const current = rows.find((r) => r.row === row);
  if (!current || current.input[tickerKey].toUpperCase() !== expectTicker.toUpperCase()) throw new RowChangedError();
  return { headers, current };
}

export async function updateTabRow<K extends string>(tab: string, fields: readonly Field<K>[], tickerKey: K, row: number,
  expectTicker: string, input: Partial<Record<K, string>>, cell: CellFn<K>): Promise<void> {
  await checkTabRow(tab, fields, tickerKey, row, expectTicker);
  const headers = await ensureTab(tab, fields.map((f) => f.header));
  const data = fields
    .filter((f) => f.key in input && headers.includes(f.header))
    .map((f) => ({ range: rng(tab, `${colLetter(headers.indexOf(f.header))}${row}`), values: [[cell(f.key, input[f.key] ?? "")]] }));
  if (data.length) await writeValues(data);
}

export async function removeTabRow<K extends string>(tab: string, fields: readonly Field<K>[], tickerKey: K, row: number,
  expectTicker: string): Promise<void> {
  await checkTabRow(tab, fields, tickerKey, row, expectTicker);
  const props = await sheetProps(tab);
  if (!props) throw new Error(`'${tab}' tab not found`);
  await deleteRow(props.sheetId, row);
}
