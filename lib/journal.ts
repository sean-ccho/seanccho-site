import type { Dict } from "./i18n";
import { addTabRow, normDate, readTab, removeTabRow, safeText, text, toNum, updateTabRow } from "./tab";

// 구글 시트 '매매일지' 탭 — 판 매매 기록. 웹만 쓴다 (내계좌에서 '매도'를 누르거나 여기서 직접 추가).
// 탭이 없으면 첫 기록 때 만든다.

export const JOURNAL_TAB = "매매일지";

export const JOURNAL_FIELDS = [
  { key: "ticker", header: "티커" },
  { key: "company", header: "회사명" },
  { key: "buyDate", header: "매수일" },
  { key: "buyPrice", header: "매수가" },
  { key: "shares", header: "수량" },
  { key: "sellDate", header: "매도일" },
  { key: "sellPrice", header: "매도가" },
  { key: "reason", header: "매수이유" },
  { key: "memo", header: "메모" },
] as const;

export type JournalKey = (typeof JOURNAL_FIELDS)[number]["key"];
export type JournalInput = Record<JournalKey, string>;

export type JournalRow = {
  row: number;
  input: JournalInput;
  buyPrice: number | null;
  sellPrice: number | null;
  shares: number | null;
};

const NUM_KEYS: JournalKey[] = ["buyPrice", "shares", "sellPrice"];
const DATE_KEYS: JournalKey[] = ["buyDate", "sellDate"];

export function journalCell(key: JournalKey, v: string): string | number {
  if (!v) return "";
  if (NUM_KEYS.includes(key)) return Number(v);
  if (DATE_KEYS.includes(key)) return v;
  return safeText(v);
}

export async function readJournal(): Promise<{ rows: JournalRow[]; exists: boolean }> {
  const { rows, exists } = await readTab(JOURNAL_TAB, JOURNAL_FIELDS, "ticker");
  return {
    exists,
    rows: rows.map((r) => {
      const input = { ...r.input, buyDate: normDate(r.input.buyDate), sellDate: normDate(r.input.sellDate) };
      return {
        row: r.row,
        input,
        buyPrice: toNum(r.cells["매수가"]),
        sellPrice: toNum(r.cells["매도가"]),
        shares: toNum(r.cells["수량"]),
      };
    }),
  };
}

const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 폼 → 검사한 입력 (매수·매도 가격·날짜는 꼭 있어야 성적을 낸다). */
export function parseJournalInput(form: FormData, t: Dict): { input: JournalInput } | { error: string } {
  const input = Object.fromEntries(JOURNAL_FIELDS.map((f) => [f.key, text(form.get(f.key))])) as JournalInput;
  input.ticker = input.ticker.toUpperCase();
  if (!TICKER_RE.test(input.ticker)) return { error: t.account.errTicker };
  const labels: Record<string, string> = {
    buyPrice: t.account.colBuyPrice, sellPrice: t.journal.colSellPrice, shares: t.account.colShares,
  };
  for (const key of NUM_KEYS) {
    const v = input[key].replace(/[$,]/g, "");
    if (!(Number.isFinite(Number(v)) && Number(v) > 0)) return { error: t.journal.errPositive(labels[key]) };
    input[key] = v;
  }
  for (const key of DATE_KEYS) {
    if (!DATE_RE.test(input[key]) || Number.isNaN(new Date(`${input[key]}T00:00:00Z`).getTime())) {
      return { error: t.journal.errDates };
    }
  }
  if (input.sellDate < input.buyDate) return { error: t.journal.errOrder };
  if (input.company.length > 80 || input.memo.length > 300 || input.reason.length > 40) {
    return { error: t.account.errTooLong(t.account.colMemo) };
  }
  return { input };
}

export async function addJournal(input: JournalInput): Promise<void> {
  await addTabRow(JOURNAL_TAB, JOURNAL_FIELDS, input, journalCell);
}

export async function updateJournal(row: number, expectTicker: string, input: JournalInput): Promise<void> {
  await updateTabRow(JOURNAL_TAB, JOURNAL_FIELDS, "ticker", row, expectTicker, input, journalCell);
}

export async function removeJournal(row: number, expectTicker: string): Promise<void> {
  await removeTabRow(JOURNAL_TAB, JOURNAL_FIELDS, "ticker", row, expectTicker);
}
