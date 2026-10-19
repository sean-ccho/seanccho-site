// 포지션 크기 — 내계좌 계산기(SizingCalc)와 차트 매수 팝업(BuyDialog)이 같이 쓴다.
// 설정(계좌 금액·1회 위험%·최대 비중%)은 이 브라우저에만 저장한다.

export type SizingSettings = { account: string; riskPct: string; maxPos: string };

export const SIZING_KEY = "sizing:v1";
export const ATR_MULT = 2;
export const PCT_STOP = 0.08;

export function loadSizing(): SizingSettings | null {
  try {
    const raw = window.localStorage.getItem(SIZING_KEY);
    return raw ? (JSON.parse(raw) as SizingSettings) : null;
  } catch {
    return null;
  }
}

export function saveSizing(v: SizingSettings): void {
  try {
    window.localStorage.setItem(SIZING_KEY, JSON.stringify(v));
  } catch {
    // 저장이 막혀도 계산은 된다
  }
}

/** '$1,234.5' 같은 입력 → 숫자 (못 읽으면 NaN). */
export function toNumber(s: string): number {
  const v = Number(s.replace(/[$,\s]/g, ""));
  return s.trim() && Number.isFinite(v) ? v : NaN;
}

/** 손절가: ATR × 2 아래 (ATR 없으면 NaN) · −8%. */
export function stopFrom(entry: number, mode: "atr" | "pct", atrPct: number | null | undefined): number {
  if (mode === "atr") return atrPct != null && atrPct > 0 ? entry * (1 - ATR_MULT * atrPct) : NaN;
  return entry * (1 - PCT_STOP);
}

/**
 * 살 주식 수 = min(계좌 × 1회 위험% ÷ 1주당 위험, 계좌 × 최대 비중% ÷ 매수가), 정수 주.
 * 1주당 위험 = 매수가 − 손절가. 값이 맞지 않으면 null.
 */
export function positionShares(p: { account: number; riskPct: number; maxPos: number; entry: number; stop: number }):
  { shares: number; byRisk: number; byCap: number; capped: boolean } | null {
  const perShare = p.entry - p.stop;
  if (!(p.account > 0 && p.entry > 0 && p.stop > 0 && perShare > 0 && p.riskPct > 0)) return null;
  const byRisk = Math.floor((p.account * p.riskPct) / 100 / perShare);
  const byCap = p.maxPos > 0 ? Math.floor((p.account * p.maxPos) / 100 / p.entry) : Number.POSITIVE_INFINITY;
  const shares = Math.max(0, Math.min(byRisk, byCap));
  return { shares, byRisk, byCap, capped: byCap < byRisk };
}
