import type { Dict } from "./i18n";
import { addTabRow, normDate, readTab, removeTabRow, safeText, text, toNum, updateTabRow } from "./tab";

// 구글 시트 '관심종목' 탭 — 사고 싶은 종목·이유·목표가. 웹이 입력 칸을 쓰고,
// Project_1 portfolio_report.py 가 매일 밤 현재가·목표까지·도달을 채워 도달하면 내계좌 메일 맨 위에 알린다.

export const WATCH_TAB = "관심종목";

export const WATCH_FIELDS = [
  { key: "ticker", header: "티커" },
  { key: "target", header: "목표가" },
  { key: "cond", header: "조건" }, // '이하' (내려오면 사기) · '이상' (넘으면 사기)
  { key: "memo", header: "메모" },
  { key: "added", header: "추가일" },
] as const;

export type WatchKey = (typeof WATCH_FIELDS)[number]["key"];
export type WatchInput = Record<WatchKey, string>;

export type WatchRow = {
  row: number;
  input: WatchInput;
  target: number | null;
  above: boolean;
  price: number | null; // 밤 파이프라인 '현재가'
  hit: boolean; // '도달'
  updated: string;
};

export async function readWatchlist(): Promise<WatchRow[]> {
  const { rows } = await readTab(WATCH_TAB, WATCH_FIELDS, "ticker");
  return rows.map((r) => ({
    row: r.row,
    input: { ...r.input, added: normDate(r.input.added) },
    target: toNum(r.cells["목표가"]),
    above: r.input.cond === "이상",
    price: toNum(r.cells["현재가"]),
    hit: text(r.cells["도달"]) === "도달",
    updated: text(r.cells["업데이트"]),
  }));
}

const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/;

export function parseWatchInput(form: FormData, t: Dict, today: string): { input: WatchInput } | { error: string } {
  const input = Object.fromEntries(WATCH_FIELDS.map((f) => [f.key, text(form.get(f.key))])) as WatchInput;
  input.ticker = input.ticker.toUpperCase();
  if (!TICKER_RE.test(input.ticker)) return { error: t.account.errTicker };
  const target = input.target.replace(/[$,]/g, "");
  if (target && !(Number(target) > 0)) return { error: t.journal.errPositive(t.watch.colTarget) };
  input.target = target;
  input.cond = input.cond === "이상" ? "이상" : "이하";
  if (input.memo.length > 300) return { error: t.account.errTooLong(t.account.colMemo) };
  input.added = /^\d{4}-\d{2}-\d{2}$/.test(input.added) ? input.added : today;
  return { input };
}

function cell(key: WatchKey, v: string): string | number {
  if (!v) return "";
  if (key === "target") return Number(v);
  if (key === "added") return v;
  return safeText(v);
}

export async function addWatch(input: WatchInput): Promise<void> {
  await addTabRow(WATCH_TAB, WATCH_FIELDS, input, cell);
}

export async function updateWatch(row: number, expectTicker: string, input: WatchInput): Promise<void> {
  await updateTabRow(WATCH_TAB, WATCH_FIELDS, "ticker", row, expectTicker, input, cell);
}

export async function removeWatch(row: number, expectTicker: string): Promise<void> {
  await removeTabRow(WATCH_TAB, WATCH_FIELDS, "ticker", row, expectTicker);
}
