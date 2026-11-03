import type { TradeHistoryItem, TradeLogItem } from "./types";

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** 0주(자리 몫으로 1주도 못 산) 거래는 성적에서 뺀다 — $5,000 계좌 요약·시트 성과요약과 같게. */
export const counted = (log: TradeLogItem[]) => log.filter((x) => x.shares !== 0 && x.return != null);

/**
 * $5,000 계좌 청산 성적 (편도 0.1% · 정수 주식 기준) — PT-1 탭과 PT 거래로그가 같은 숫자를 쓰게 (2026-11-02).
 * 예전엔 PT-1 탭이 Project_1 요약(신호 수익률)을 써서 승률이 거래로그와 달랐다 (37.5% vs 34%).
 */
export function logStats(log: TradeLogItem[]) {
  const c = counted(log);
  const rets = c.map((x) => x.return as number);
  const ex = c.map((x) => x.vs_spy).filter((v): v is number => v != null);
  const pnls = c.map((x) => x.pnl).filter((v): v is number => v != null);
  const wins = rets.filter((v) => v > 0).length;
  return {
    n: c.length,
    wins,
    win: rets.length ? wins / rets.length : null,
    avg: mean(rets),
    avgEx: mean(ex),
    beat: ex.length ? ex.filter((v) => v > 0).length / ex.length : null,
    beatN: ex.filter((v) => v > 0).length,
    exN: ex.length,
    realized: pnls.length ? pnls.reduce((a, b) => a + b, 0) : null,
  };
}

/** 거래별 막대(TradeStrip)용 — 같은 $5,000 계좌 기준, 청산일 순. */
export function logHistory(log: TradeLogItem[]): TradeHistoryItem[] {
  return counted(log)
    .map((x) => ({ ticker: x.ticker, exit_date: x.exit_date, return: x.return as number, exit_reason: x.exit_reason }))
    .sort((a, b) => (a.exit_date < b.exit_date ? -1 : a.exit_date > b.exit_date ? 1 : 0));
}
