import { spyReturn } from "./bench";
import type { Benchmark } from "./types";

// 판 거래 성적 (내계좌의 매도 완료 줄) — 거래마다 같은 기간 SPY 와 비교하고, 매수이유별로 묶는다.
// '판단'은 대략적인 신호다: 매매마다 기간이 달라 서로 독립이 아니고, 10건 미만이면 아예 판단하지 않는다.

/** 판 거래 한 줄 — 내계좌 AccountRow 가 이 모양을 그대로 만족한다. */
export type ClosedTrade = {
  row: number;
  input: { buyDate: string; sellDate: string; reason: string; sellReason?: string };
  buyPrice: number | null;
  sellPrice: number | null;
  shares: number | null;
  stop?: number | null; // 판 때 시트에 있던 손절가 (손절가를 지켰나 묶음)
};

/**
 * 매도 이유 (2026-11-26) — 시트 '매도이유' 칸에 이 한국어 글자 그대로 적는다 (화면 이름은 i18n account.sellWhy).
 * 매도 폼은 이 중에서 고르고, 수정 폼은 직접 적을 수도 있다.
 */
export const SELL_REASONS = ["손절", "목표가", "실적 전", "매수 이유 사라짐", "비중 줄이기", "기타"] as const;
export type SellReason = (typeof SELL_REASONS)[number];

/**
 * 손절가를 지켰나 (2026-11-26) — 판 가격과 그때 손절가로만 나눈다 (장중 경로는 모른다).
 * kept = 손절가 위에서 팜 (손절가의 3% 아래까지는 지킨 것으로 — 갭 · 30분 확인 간격 여유),
 * late = 손절가보다 3% 넘게 아래에서 팜 (손절가를 넘기고 버팀), none = 손절가 없이 산 거래.
 */
export type StopGroup = "kept" | "late" | "none";
export const STOP_GROUPS: StopGroup[] = ["kept", "late", "none"];
export const STOP_SLACK = 0.03;

export function stopGroup(r: { stop?: number | null; sellPrice: number | null }): StopGroup {
  if (!r.stop || !r.sellPrice) return "none";
  return r.sellPrice < r.stop * (1 - STOP_SLACK) ? "late" : "kept";
}

export type TradeCalc = {
  row: ClosedTrade;
  ret: number | null; // 매도가 ÷ 매수가 − 1
  pnl: number | null; // (매도가 − 매수가) × 수량
  spy: number | null; // 같은 기간 SPY
  excess: number | null; // ret − spy
  days: number | null; // 보유 달력일
};

export type Verdict = "few" | "none" | "better" | "worse";

export type ReasonStat = {
  reason: string; // '' = 이유 없음
  n: number;
  wins: number;
  avgRet: number | null;
  avgSpy: number | null;
  avgExcess: number | null;
  beat: number; // SPY 를 이긴 매매 수
  nSpy: number; // SPY 비교가 되는 매매 수
  pnl: number;
  avgDays: number | null;
  t: number | null; // 초과수익 평균의 t
  verdict: Verdict;
};

export const MIN_JUDGE = 10;

function daysBetween(a: string, b: string): number | null {
  const d = (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(d) ? d : null;
}

export function calcTrade(r: ClosedTrade, bench: Benchmark | null | undefined): TradeCalc {
  const { buyPrice: b, sellPrice: s, shares: n } = r;
  const ret = b && s ? s / b - 1 : null;
  const spy = spyReturn(bench, r.input.buyDate, r.input.sellDate);
  return {
    row: r,
    ret,
    pnl: b != null && s != null && n != null ? (s - b) * n : null,
    spy,
    excess: ret != null && spy != null ? ret - spy : null,
    days: r.input.buyDate && r.input.sellDate ? daysBetween(r.input.buyDate, r.input.sellDate) : null,
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function tStat(xs: number[]): number | null {
  if (xs.length < 3) return null;
  const m = mean(xs) as number;
  const sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
  return sd > 0 ? m / (sd / Math.sqrt(xs.length)) : null;
}

export function stat(reason: string, trades: TradeCalc[]): ReasonStat {
  const rets = trades.map((x) => x.ret).filter((v): v is number => v != null);
  const ex = trades.map((x) => x.excess).filter((v): v is number => v != null);
  const t = tStat(ex);
  let verdict: Verdict = "none";
  if (ex.length < MIN_JUDGE) verdict = "few";
  else if (t != null && t >= 2) verdict = "better";
  else if (t != null && t <= -2) verdict = "worse";
  return {
    reason,
    n: trades.length,
    wins: rets.filter((v) => v > 0).length,
    avgRet: mean(rets),
    avgSpy: mean(trades.map((x) => x.spy).filter((v): v is number => v != null)),
    avgExcess: mean(ex),
    beat: ex.filter((v) => v > 0).length,
    nSpy: ex.length,
    pnl: trades.reduce((a, x) => a + (x.pnl ?? 0), 0),
    avgDays: mean(trades.map((x) => x.days).filter((v): v is number => v != null)),
    t,
    verdict,
  };
}

/**
 * 전체 + 묶음별 — keyOf 로 묶는다 (매수이유 · 매도이유 · 손절가를 지켰나). order 가 있으면 그 순서, 없으면 매매 많은 순.
 * 정렬 언어를 고정한다 (2026-11-26) — 기본값이면 서버(영어: 'PT-1' 먼저)와 한국어 브라우저(한글 먼저)의 순서가 달라 화면이 다시 그려졌다
 */
export function summarizeBy(trades: TradeCalc[], keyOf: (x: TradeCalc) => string, order?: readonly string[]):
  { all: ReasonStat; byReason: ReasonStat[] } {
  const groups = new Map<string, TradeCalc[]>();
  for (const x of trades) {
    const k = keyOf(x);
    groups.set(k, [...(groups.get(k) ?? []), x]);
  }
  const rank = (k: string) => (order ? (order.indexOf(k) + 1 || order.length + 1) : 0);
  const byReason = [...groups].map(([k, v]) => stat(k, v))
    .sort((a, b) => rank(a.reason) - rank(b.reason) || b.n - a.n || a.reason.localeCompare(b.reason, "ko"));
  return { all: stat("", trades), byReason };
}

/** 전체 + 매수이유별 (매매 많은 순). */
export function summarize(trades: TradeCalc[]): { all: ReasonStat; byReason: ReasonStat[] } {
  return summarizeBy(trades, (x) => x.row.input.reason.trim());
}
