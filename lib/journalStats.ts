import { spyReturn } from "./bench";
import type { Benchmark } from "./types";

// 판 거래 성적 (내계좌의 매도 완료 줄) — 거래마다 같은 기간 SPY 와 비교하고, 매수이유별로 묶는다.
// '판단'은 대략적인 신호다: 매매마다 기간이 달라 서로 독립이 아니고, 10건 미만이면 아예 판단하지 않는다.

/** 판 거래 한 줄 — 내계좌 AccountRow 가 이 모양을 그대로 만족한다. */
export type ClosedTrade = {
  row: number;
  input: { buyDate: string; sellDate: string; reason: string };
  buyPrice: number | null;
  sellPrice: number | null;
  shares: number | null;
};

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

/** 전체 + 매수이유별 (매매 많은 순). */
export function summarize(trades: TradeCalc[]): { all: ReasonStat; byReason: ReasonStat[] } {
  const groups = new Map<string, TradeCalc[]>();
  for (const x of trades) {
    const k = x.row.input.reason.trim();
    groups.set(k, [...(groups.get(k) ?? []), x]);
  }
  const byReason = [...groups].map(([k, v]) => stat(k, v)).sort((a, b) => b.n - a.n || a.reason.localeCompare(b.reason));
  return { all: stat("", trades), byReason };
}
