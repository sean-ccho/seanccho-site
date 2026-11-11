import type { EtfItem } from "./etf";
import { QUADS, quadOf, type Quad } from "./stockStyle";
import type { StockRegion, StockStyle, TickerInfo } from "./types";

// 섹터 지도 (/quant/sectors, 2026-10-29 · 2026-11-10 개편) — S&P 500 을 4칸(경기순환/방어 × 내수/글로벌)으로 묶고,
// 섹터마다 글로벌 · 내수 매출 중심 대표 기업을 나란히 고른다. 대표 기업 규칙은 Project_1 screener/sector_reps.py
// (시트 [섹터 대표])와 같다: 지역 × 섹터마다 시가총액 상위 4개. 한 섹터만 볼 때는 상위 10개까지.

/** Yahoo 섹터 — 사용자 시트 순서. */
export const SECTOR_ORDER = [
  "Communication Services", "Consumer Cyclical", "Consumer Defensive", "Energy", "Financial Services", "Healthcare",
  "Industrials", "Technology", "Basic Materials", "Real Estate", "Utilities",
] as const;
export const REPS_TOP = 4;
export const FOCUS_TOP = 10;
const QUAD_LEADERS = 4;
const QUAD_INDUSTRIES = 6;
// 시장 전체 ETF(VOO · VTI · 캐나다 S&P 500 …)는 상위 10개가 대형 기술주라 '글로벌 순환'으로 나오지만 한 칸의 대표가 아니라서 뺀다
export const BROAD_GROUPS = new Set(["us_market", "canada"]);

/**
 * SPDR 섹터 ETF — 섹터 머리의 시가총액 가중 참고값. 중앙값(가운데 종목)과 다르게 큰 종목 몇 개가 크게 움직이면 같이 끌려간다
 * (2026-11-09 커뮤니케이션: 22종목 중앙값 1달 +5.3% · XLC −2.7% — 시가총액 가장 큰 두 종목이 −14~−18%).
 */
export const SECTOR_ETF: Record<string, string> = {
  "Communication Services": "XLC", "Consumer Cyclical": "XLY", "Consumer Defensive": "XLP", Energy: "XLE",
  "Financial Services": "XLF", Healthcare: "XLV", Industrials: "XLI", Technology: "XLK", "Basic Materials": "XLB",
  "Real Estate": "XLRE", Utilities: "XLU",
};

/** 기간 — 1주 = 5거래일 · 1달 = 20 · 3달 = 63 · 1년 = 252 (ETF 는 etf.json ret 의 w1 · m1 · m3 · y1). */
export type Period = "w1" | "m1" | "m3" | "y1";
export const PERIODS: Period[] = ["w1", "m1", "m3", "y1"];
export const DEFAULT_PERIOD: Period = "m1";
export type Rets = Record<Period, number | null>;

/** 표 한 줄 (브라우저로 넘기는 만큼만). */
export type MapRow = {
  ticker: string;
  company: string | null;
  exchange: string;
  industry: string | null; // Yahoo 세부 업종 (영어 — 화면에서 번역)
  price: number | null;
  style: StockStyle; // us_share 가 있으면 막대, 없으면 '추정' + 근거 말풍선
  ret: Rets;
};

/** 묶음 숫자 — 종목 수, 기간마다 중앙값 · 오른 종목 수 · 수익률이 있는 종목 수(3달 · 1년은 상장이 짧으면 빠진다). */
export type GroupStats = { n: number; med: Rets; up: Record<Period, number>; has: Record<Period, number> };

export type EtfChip = { ticker: string; name: string | null; ret: Rets };

export type QuadCard = { quad: Quad; stats: GroupStats; industries: [string, number][]; leaders: MapRow[]; etfs: EtfChip[] };

export type SectorSide = { stats: GroupStats; rows: MapRow[] }; // rows = 시가총액 큰 순 FOCUS_TOP 개까지

export type SectorBlock = {
  key: string; // Yahoo 섹터 이름
  stats: GroupStats;
  global: SectorSide;
  domestic: SectorSide;
  industries: { name: string; stats: GroupStats }[]; // 세부 업종별 — 종목 많은 순
  etf: EtfChip | null;
};

export type SectorMapData = { all: GroupStats; quads: QuadCard[]; sectors: SectorBlock[] }; // all = 성격이 실린 S&P 500 전부

type Stock = { ticker: string; info: TickerInfo; cap: number; ret: Rets };

function median(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// 브라우저로 넘기는 숫자는 소수 4자리(0.01%)까지 — 화면은 0.1% 까지라 충분하고 넘기는 양이 준다
const r4 = (v: number | null | undefined): number | null => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4);

function stockRets(i: TickerInfo): Rets {
  return { w1: r4(i.ret_5d), m1: r4(i.ret_20d), m3: r4(i.ret_63d), y1: r4(i.ret_252d) };
}

function etfChip(e: EtfItem): EtfChip {
  return { ticker: e.ticker, name: e.name, ret: { w1: r4(e.ret.w1), m1: r4(e.ret.m1), m3: r4(e.ret.m3), y1: r4(e.ret.y1) } };
}

/** 묶음의 기간별 중앙값 · 오른 종목 수. */
export function groupStats(stocks: { ret: Rets }[]): GroupStats {
  const med = {} as Rets;
  const up = {} as Record<Period, number>;
  const has = {} as Record<Period, number>;
  for (const p of PERIODS) {
    const v = stocks.map((s) => s.ret[p]).filter((x): x is number => x != null && Number.isFinite(x));
    med[p] = r4(median(v));
    up[p] = v.filter((x) => x > 0).length;
    has[p] = v.length;
  }
  return { n: stocks.length, med, up, has };
}

function toRow(s: Stock): MapRow {
  const tv = s.info.tv ?? "";
  return {
    ticker: s.ticker, company: s.info.company, exchange: tv.includes(":") ? tv.split(":")[0] : "",
    industry: s.info.industry ?? null, price: s.info.price, style: s.info.style!, ret: s.ret,
  };
}

const byCap = (a: Stock, b: Stock) => b.cap - a.cap;

/**
 * 화면 데이터 — 성격(경기 · 지역)이 실린 종목만. 4칸(종목 수 · 기간별 중앙값 · 많은 업종 · 시가총액 큰 순 · 그 칸이 주인 ETF —
 * 상위 10개 보유 종목 기준) + 섹터마다 전체 · 글로벌 · 내수 숫자, 시가총액 큰 순 대표, 세부 업종별 숫자, SPDR 섹터 ETF.
 */
export function sectorMapData(items: Record<string, TickerInfo>, etfs: EtfItem[]): SectorMapData {
  const stocks: Stock[] = [];
  for (const [ticker, info] of Object.entries(items)) {
    if (!quadOf(info.style)) continue;
    stocks.push({ ticker, info, cap: info.fundamentals?.market_cap ?? 0, ret: stockRets(info) });
  }
  const etfBy = new Map(etfs.map((e) => [e.ticker, e]));

  const quads: QuadCard[] = QUADS.map((quad) => {
    const qs = stocks.filter((s) => quadOf(s.info.style) === quad);
    const ind = new Map<string, number>();
    for (const s of qs) if (s.info.industry) ind.set(s.info.industry, (ind.get(s.info.industry) ?? 0) + 1);
    return {
      quad,
      stats: groupStats(qs),
      industries: [...ind.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, QUAD_INDUSTRIES),
      leaders: [...qs].sort(byCap).slice(0, QUAD_LEADERS).map(toRow),
      etfs: etfs
        .filter((e) => !BROAD_GROUPS.has(e.group) && e.style_mix?.top === quad)
        .sort((a, b) => (b.aum ?? 0) - (a.aum ?? 0))
        .map(etfChip),
    };
  });

  const sectors: SectorBlock[] = [];
  for (const key of SECTOR_ORDER) {
    const ss = stocks.filter((s) => s.info.sector === key);
    if (!ss.length) continue;
    const side = (r: StockRegion): SectorSide => {
      const rs = ss.filter((s) => s.info.style?.region === r);
      return { stats: groupStats(rs), rows: rs.filter((s) => s.cap > 0).sort(byCap).slice(0, FOCUS_TOP).map(toRow) };
    };
    const ind = new Map<string, Stock[]>();
    for (const s of ss) if (s.info.industry) ind.set(s.info.industry, [...(ind.get(s.info.industry) ?? []), s]);
    const etf = etfBy.get(SECTOR_ETF[key]);
    sectors.push({
      key,
      stats: groupStats(ss),
      global: side("global"),
      domestic: side("domestic"),
      industries: [...ind.entries()]
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
        .map(([name, xs]) => ({ name, stats: groupStats(xs) })),
      etf: etf ? etfChip(etf) : null,
    });
  }
  return { all: groupStats(stocks), quads, sectors };
}

/** 4칸 '전부 보기' — 전체분석 S&P 500 탭을 그 칸 필터 + 시가총액 큰 순으로 (칸의 '시가총액 큰 순'이 그대로 이어지게). */
export function quadListHref(quad: Quad): string {
  const [cycle, region] = quad.split("_");
  return `/quant/universe?m=sp500&cycle=${cycle}&region=${region}&s=marketcap`;
}

/** 4칸 관련 ETF '표로 보기' — ETF 화면을 그 성격만 걸러서 (?style=). */
export function quadEtfHref(quad: Quad): string {
  return `/quant/etf?style=${quad}`;
}
