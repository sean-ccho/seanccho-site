// 실적 위험 (2026-10-29) — Project_1 src/screener/earnings_moves.py 와 같은 규칙.
// 보유 종목이 실적 발표 다음 날 크게 떨어진 뒤 만들었다: 매수 창 경고 · 차트 배지 · 내계좌 '다음 2주 실적'이 쓴다.
// 연구(Project_1 docs/quant_improvement/tier3/EARNINGS_GUARD_REPORT.md): 실적 2주 안에 안 사기·실적 구간 비우기 →
// 수익은 그대로, 한 종목 최악 손실은 절반 (Sharpe 개선은 통계 기준 미달).

import type { EarningsMove } from "./types";

/** 실적까지 이 달력일 안이면 '실적 임박' (연구 규칙 10거래일 ≈ 14일). */
export const EARN_WINDOW_DAYS = 14;
/** 나쁜 경우 = max(최근 최악 하락, 평균 × 3), 최대 50% — S&P 500 실적 25,723건에서 이보다 더 빠진 건 2.6% (40번에 1번꼴). */
const BAD_MULT = 3;
const BAD_CAP = 0.5;

export const DECISIONS = ["팔기", "절반", "그대로"] as const;
export type Decision = (typeof DECISIONS)[number];

/** 나쁜 경우 하락률 (양수). 평균을 모르면 null. */
export function badCase(avg: number | null | undefined, worst: number | null | undefined): number | null {
  if (avg == null || !Number.isFinite(avg) || avg <= 0) return null;
  const w = worst != null && Number.isFinite(worst) && worst < 0 ? -worst : 0;
  return Math.min(BAD_CAP, Math.max(BAD_MULT * avg, w));
}

/** 'YYYY-MM-DD' 두 날짜 사이 달력일 (b − a). 못 읽으면 null. */
export function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const d = Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  return Number.isFinite(d) ? d : null;
}

/** 0 ≤ 남은 날 ≤ 14 */
export function isSoon(days: number | null): days is number {
  return days != null && days >= 0 && days <= EARN_WINDOW_DAYS;
}

/** 실적 1회에 계좌의 riskPct% 까지만 잃게 하는 최대 주식 수 (나쁜 경우 기준). 못 구하면 null. */
export function budgetShares(account: number, riskPct: number, price: number, bad: number | null): number | null {
  if (!(account > 0 && riskPct > 0 && price > 0 && bad != null && bad > 0)) return null;
  return Math.floor((account * riskPct) / 100 / (price * bad));
}

/** 시트 '실적대응' 칸 '절반 · 2026-11-04' → 그 실적일 결정이면 '절반', 다른 날짜(지난 실적)면 null. */
export function decisionOf(cell: string | null | undefined, earn: string | null | undefined): Decision | null {
  const s = (cell ?? "").trim();
  if (!s || !earn) return null;
  const [word, day] = s.split("·").map((x) => x.trim());
  return (DECISIONS as readonly string[]).includes(word) && day === earn.slice(0, 10) ? (word as Decision) : null;
}

export function decisionCell(d: Decision, earn: string): string {
  return `${d} · ${earn.slice(0, 10)}`;
}

/** 시트 칸이 있으면 그것, 없으면 웹 종목 정보. */
export function pickMove(sheet: { avg: number | null; worst: number | null; timing: EarningsMove["timing"] },
  web: EarningsMove | null | undefined): { avg: number; worst: number | null; timing: EarningsMove["timing"]; n: number | null } | null {
  if (sheet.avg != null) return { avg: sheet.avg, worst: sheet.worst, timing: sheet.timing ?? web?.timing ?? null, n: web?.n ?? null };
  if (web) return { avg: web.avg, worst: web.worst, timing: web.timing, n: web.n };
  return null;
}

// ── 미국 증시 거래일 (NYSE 정규 휴장일 — 임시 휴장은 모른다) ──────────────────────────

function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

function addDays(s: string, n: number): string {
  return new Date(Date.parse(`${s}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

function weekday(s: string): number {
  return new Date(`${s}T00:00:00Z`).getUTCDay(); // 0 = 일요일
}

function nthWeekday(y: number, m: number, wd: number, n: number): string {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return iso(y, m, 1 + ((wd - first + 7) % 7) + (n - 1) * 7);
}

function lastWeekday(y: number, m: number, wd: number): string {
  const last = new Date(Date.UTC(y, m, 0));
  return iso(y, m, last.getUTCDate() - ((last.getUTCDay() - wd + 7) % 7));
}

function observed(s: string): string {
  const w = weekday(s);
  return w === 6 ? addDays(s, -1) : w === 0 ? addDays(s, 1) : s;
}

function easter(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, month, day);
}

const holidayCache = new Map<number, Set<string>>();

function holidays(y: number): Set<string> {
  const hit = holidayCache.get(y);
  if (hit) return hit;
  const days = new Set([
    nthWeekday(y, 1, 1, 3), nthWeekday(y, 2, 1, 3), addDays(easter(y), -2), lastWeekday(y, 5, 1),
    observed(iso(y, 7, 4)), nthWeekday(y, 9, 1, 1), nthWeekday(y, 11, 4, 4), observed(iso(y, 12, 25)),
  ]);
  if (weekday(iso(y, 1, 1)) !== 6) days.add(observed(iso(y, 1, 1))); // 1-1 이 토요일이면 따로 쉬지 않는다
  if (y >= 2022) days.add(observed(iso(y, 6, 19)));
  holidayCache.set(y, days);
  return days;
}

export function isSession(s: string): boolean {
  const w = weekday(s);
  return w !== 0 && w !== 6 && !holidays(Number(s.slice(0, 4))).has(s);
}

function addSessions(s: string, k: number): string {
  let d = s;
  for (let left = Math.abs(k); left > 0;) {
    d = addDays(d, k >= 0 ? 1 : -1);
    if (isSession(d)) left -= 1;
  }
  return d;
}

/** 실적이 가격에 처음 반영되는 날 — 장 마감 후면 다음 거래일, 장 전·모르면 그날 (휴장이면 다음 거래일). */
export function reactionDate(earn: string, timing: EarningsMove["timing"] | undefined): string {
  if (timing === "amc") return addSessions(earn, 1);
  return isSession(earn) ? earn : addSessions(earn, 1);
}

/** 팔지 말지 정할 마지막 거래일 = 반응일 바로 전 거래일 (시간을 모르면 장 전으로 보고 더 이르게). */
export function decisionDeadline(earn: string, timing: EarningsMove["timing"] | undefined): string {
  return addSessions(reactionDate(earn, timing), -1);
}

/** today 다음 날부터 day 까지(포함) 거래일 수 — 같은 날 0, 지났으면 음수. */
export function sessionsUntil(today: string, day: string): number {
  if (day === today) return 0;
  const [lo, hi, sign] = day > today ? [today, day, 1] : [day, today, -1];
  let n = 0;
  for (let d = addDays(lo, 1); d <= hi; d = addDays(d, 1)) if (isSession(d)) n += 1;
  return sign * n;
}
