import type { Dict } from "./i18n";
import type { StockCycle, StockRegion, StockStyle } from "./types";

// 경기순환/방어 × 내수/글로벌 4칸 (2026-10-29) — 배지 · 필터 · 섹터 지도 · ETF 가 같이 쓰는 이름과 설명

export type Quad = `${StockCycle}_${StockRegion}`;
/** 사용자 표 순서 — 내수 순환 · 글로벌 순환 · 내수 방어 · 글로벌 방어. */
export const QUADS: Quad[] = ["cyclical_domestic", "cyclical_global", "defensive_domestic", "defensive_global"];

export function quadOf(s: StockStyle | null | undefined): Quad | null {
  return s?.cycle && s.region ? `${s.cycle}_${s.region}` : null;
}

const pct0 = (v: number) => `${Math.round(v * 100)}%`;

/** 매출 지역의 근거 한 줄 — '미국 매출 82% (10-K 2025-12-31)' · '지역별 매출 공시 없음 → 대부분 미국으로 추정' …. */
export function regionBasis(t: Dict, s: StockStyle): string {
  const S = t.style;
  switch (s.src) {
    case "sec":
      return s.us_share != null ? S.basisSec(pct0(s.us_share), s.fy) : S.basisIndustry;
    case "sec_regions": {
      const f = s.foreign_min != null ? pct0(s.foreign_min) : "—";
      return s.region === "global" ? S.basisRegionsGlobal(f) : S.basisRegionsDomestic(f);
    }
    case "sec_none":
      return S.basisNone;
    case "foreign":
      return S.basisForeign;
    default:
      return S.basisIndustry;
  }
}

/** 배지 · 줄에 붙이는 짧은 글자 — '방어·내수' (모르는 칸은 빼고). */
export function styleShort(t: Dict, s: StockStyle): string {
  return [s.cycle && t.style.cycleShort[s.cycle], s.region && t.style.region[s.region]].filter(Boolean).join("·");
}

/** 마우스를 올리면 보이는 설명 (여러 줄). */
export function styleTitle(t: Dict, s: StockStyle): string {
  const S = t.style;
  const lines = [
    [s.cycle && S.cycle[s.cycle], s.region && S.region[s.region]].filter(Boolean).join(" · "),
    s.region ? regionBasis(t, s) : "",
    s.cycle ? S.cycleBasis : "",
    S.note,
  ];
  return lines.filter(Boolean).join("\n");
}
