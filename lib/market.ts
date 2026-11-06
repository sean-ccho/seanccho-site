// 오늘 탭 '시장 한눈에' · '실적 발표 일정'과 종목 '한눈에'가 같이 쓰는 작은 계산 (2026-11-03).

import type { Valuation, ValKey } from "./types";

const SUFFIX =
  /,?\s+(?:Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Company|Ltd\.?|Limited|plc|PLC|N\.V\.|S\.A\.|SE|AG|Holdings?|Group|Technologies|Technology)$/;

/** 'Merck & Company, Inc.' → 'Merck & Company' — 목록에서 좁은 칸에 넣을 회사 이름. */
export function shortCompany(name: string | null | undefined): string {
  let s = (name ?? "").trim();
  for (let i = 0; i < 3; i++) {
    const next = s.replace(SUFFIX, "").replace(/[,&\s]+$/, "");
    if (next === s || !next) break;
    s = next;
  }
  return s;
}

/** 시가총액 문턱 글자 — 2e9 → '$2B', 캐나다(cad) 1e9 → 'C$1B'. */
export function capLabel(v: number, cad = false): string {
  const c = cad ? "C$" : "$";
  return v >= 1e12 ? `${c}${v / 1e12}T` : v >= 1e9 ? `${c}${v / 1e9}B` : `${c}${Math.round(v / 1e6)}M`;
}

export type ValCompare = { kind: "loss" | "cheaper" | "pricier" | "similar" | "none"; ratio: number | null };

/** 이 종목 값 ÷ 업종 중앙값 — ±10% 안은 비슷, 음수는 적자. */
export function compareVal(self: number | null | undefined, ind: number | null | undefined): ValCompare {
  if (self == null) return { kind: "none", ratio: null };
  if (self <= 0) return { kind: "loss", ratio: null };
  if (ind == null || ind <= 0) return { kind: "none", ratio: null };
  const ratio = self / ind;
  return { kind: ratio < 0.9 ? "cheaper" : ratio > 1.1 ? "pricier" : "similar", ratio };
}

/** '한눈에' 칸에 쓸 PER — 선행 PER 이 있으면 그것 (일회성 비용에 덜 흔들린다), 없으면 PER. */
export function headlinePe(v: Valuation): { key: ValKey; self: number | null; ind: number | null } {
  if (v.fpe != null && v.fpe > 0) return { key: "fpe", self: v.fpe, ind: v.ind.fpe ?? null };
  return { key: "pe", self: v.pe, ind: v.ind.pe ?? null };
}

/** PER 이 선행 PER 의 2.5배를 넘으면 — 최근 1년 이익이 일시적으로 줄었다는 뜻. */
export function peSpike(v: Valuation): boolean {
  return v.pe != null && v.fpe != null && v.fpe > 0 && v.pe / v.fpe > 2.5;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
