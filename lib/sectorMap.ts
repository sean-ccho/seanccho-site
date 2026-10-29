import type { EtfItem } from "./etf";
import { QUADS, quadOf, type Quad } from "./stockStyle";
import type { StockRegion, TickerInfo } from "./types";

// 섹터 지도 (/quant/sectors, 2026-10-29) — S&P 500 을 4칸(경기순환/방어 × 내수/글로벌)으로 묶고, 섹터별 대표 기업을 고른다.
// 대표 기업 규칙은 Project_1 screener/sector_reps.py (시트 [섹터 대표])와 같다: 지역 × 섹터마다 시가총액 상위 4개.

/** Yahoo 섹터 — 사용자 시트 순서. */
export const SECTOR_ORDER = [
  "Communication Services", "Consumer Cyclical", "Consumer Defensive", "Energy", "Financial Services", "Healthcare",
  "Industrials", "Technology", "Basic Materials", "Real Estate", "Utilities",
] as const;
export const REPS_TOP = 4;
// 시장 전체 ETF(VOO · VTI · 캐나다 S&P 500 …)는 상위 10개가 대형 기술주라 '글로벌 순환'으로 나오지만 한 칸의 대표가 아니라서 뺀다
const BROAD_GROUPS = new Set(["us_market", "canada"]);

export type MapStock = {
  ticker: string;
  company: string | null;
  exchange: string;
  price: number | null;
  cap: number;
  ret5: number | null;
  ret20: number | null;
  info: TickerInfo;
};

export type QuadBox = {
  quad: Quad;
  count: number;
  med5: number | null;
  med20: number | null;
  industries: [string, number][]; // 많은 순
  leaders: MapStock[];
  etfs: EtfItem[];
};

function median(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function toStock(ticker: string, info: TickerInfo): MapStock {
  const tv = info.tv ?? "";
  return {
    ticker, company: info.company, exchange: tv.includes(":") ? tv.split(":")[0] : "", price: info.price,
    cap: info.fundamentals?.market_cap ?? 0, ret5: info.ret_5d, ret20: info.ret_20d, info,
  };
}

/** 4칸 — 종목 수 · 1주 · 1달 중앙값 · 많은 업종 · 시총 큰 종목 · 그 칸이 주인 ETF (상위 10개 보유 종목 기준). */
export function quadBoxes(items: Record<string, TickerInfo>, etfs: EtfItem[], industriesTop = 8, leadersTop = 6): QuadBox[] {
  const by = new Map<Quad, MapStock[]>(QUADS.map((q) => [q, []]));
  for (const [t, info] of Object.entries(items)) {
    const q = quadOf(info.style);
    if (q) by.get(q)!.push(toStock(t, info));
  }
  return QUADS.map((quad) => {
    const stocks = by.get(quad)!;
    const ind = new Map<string, number>();
    for (const s of stocks) if (s.info.industry) ind.set(s.info.industry, (ind.get(s.info.industry) ?? 0) + 1);
    return {
      quad,
      count: stocks.length,
      med5: median(stocks.map((s) => s.ret5)),
      med20: median(stocks.map((s) => s.ret20)),
      industries: [...ind.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, industriesTop),
      leaders: [...stocks].sort((a, b) => b.cap - a.cap).slice(0, leadersTop),
      etfs: etfs.filter((e) => !BROAD_GROUPS.has(e.group) && e.style_mix?.top === quad).sort((a, b) => (b.aum ?? 0) - (a.aum ?? 0)),
    };
  });
}

/** 섹터별 대표 기업 — 그 지역(글로벌 · 내수) 종목만, 섹터마다 시가총액 상위 top. 종목이 없는 섹터는 빠진다. */
export function sectorReps(items: Record<string, TickerInfo>, region: StockRegion, top = REPS_TOP): [string, MapStock[]][] {
  const out: [string, MapStock[]][] = [];
  for (const sec of SECTOR_ORDER) {
    const rows = Object.entries(items)
      .filter(([, i]) => i.sector === sec && i.style?.region === region && (i.fundamentals?.market_cap ?? 0) > 0)
      .map(([t, i]) => toStock(t, i))
      .sort((a, b) => b.cap - a.cap)
      .slice(0, top);
    if (rows.length) out.push([sec, rows]);
  }
  return out;
}
