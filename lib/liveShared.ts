import type { EtfItem } from "./etf";
import type { MacroIndicator } from "./macro";
import type { ExitLevels, HeatItem, LiveMark, MarketSummary, TickerInfo } from "./types";

/*
 * 장중 숫자 (2026-11-09) — 브라우저 · 서버 공용 부분 (파일 · 캐시 없이). 서버 읽기와 덮어쓰기는 lib/live.ts.
 * 전체분석 목록은 브라우저가 raw 에서 직접 받아서(수 MB) 장중 가격도 브라우저가 quotes.json 으로 고친다 (UniverseScreen).
 */
export const LIVE_BASE =
  process.env.NEXT_PUBLIC_LIVE_BASE || "https://raw.githubusercontent.com/sean-ccho/Project_1/live-data";

export type LiveSession = { state: "pre" | "open" | "closed" | "holiday"; close: string; as_of: string | null;
  pace: number | null };
export type LivePosition = {
  ticker: string;
  live: boolean;
  price: number | null;
  chg: number | null;
  return: number | null;
  highest_price: number | null;
  days_held: number;
  value: number | null;
  spy_return: number | null;
  exit: ExitLevels;
};
export type LiveCand = {
  rsi: number | null;
  ret_5d: number | null;
  position_52w: number | null;
  bband: number | null;
  vol_ratio: number | null;
  ma_gap: { daily: number | null; weekly: number | null; monthly: number | null };
  preview: { weekly: string | null; monthly: string | null };
  heat: HeatItem[];
};
export type LiveEtf = Pick<EtfItem, "date" | "price" | "ret" | "above_200" | "high_52w_gap"> & { chg: number | null };

/** live.json (Project_1 web_export/intraday_pulse.py) — 시각 · 장 상태 · 지수 · 시장 · 경기 · ETF · PT-1 · 후보 · 숏스퀴즈. */
export type LiveData = {
  schema: number;
  generated_at: string;
  day: string;
  base_day: string | null;
  final: boolean;
  session: { us: LiveSession; ca: LiveSession };
  indices: Record<string, { p: number | null; c: number | null }>;
  market: { us?: Omit<MarketSummary, "calendar" | "mega"> | null; ca?: Omit<MarketSummary, "calendar" | "mega"> | null };
  macro: { indicators: MacroIndicator[]; fx: { usdcad: number; date: string } | null } | null;
  etf: Record<string, LiveEtf>;
  pt1: {
    key: string;
    base_date: string | null;
    live: boolean;
    positions: LivePosition[];
    dollar: { equity: number | null; return: number | null; spy_equity: number | null; spy_return: number | null;
      cash: number | null; initial: number | null; date: string } | null;
  } | null;
  regime: string | null;
  cands: Record<string, LiveCand>;
  squeeze: { items: { ticker: string; status: "fire" | "fuel"; live: boolean; price: number | null; ret_5d: number | null;
    vol_ratio: number | null }[]; fire: number; fuel: number } | null;
  errors: string[];
};

/** quotes.json 한 줄 — [가격, 오늘 등락, 거래량 배수, 52주 최저, 52주 최고, 표시(1 신고가 · 2 신저가)]. */
export type QuoteRow = [number | null, number | null, number | null, number | null, number | null, number];
export type LiveQuotes = { schema: number; generated_at: string; day: string; final: boolean; as_of: string | null;
  q: Record<string, QuoteRow> };
export type Quote = { p: number; c: number | null; v: number | null; lo: number | null; hi: number | null;
  nh: boolean; nl: boolean };

/** 펄스가 그 밤 데이터보다 새 날 것인가 — 아니면 밤 데이터가 이미 그날 확정값이라 덮어쓰지 않는다. */
export function newer(mark: LiveMark | null | undefined, nightDate: string | null | undefined): mark is LiveMark {
  return !!mark && mark.day > (nightDate ?? "");
}

/** quotes.json 에서 한 종목 (없으면 null — 시세 대상이 아니거나 오늘 거래가 없음). */
export function quoteOf(quotes: LiveQuotes | null | undefined, ticker: string): Quote | null {
  const r = quotes?.q?.[ticker];
  if (!r || r[0] == null) return null;
  return { p: r[0], c: r[1], v: r[2], lo: r[3], hi: r[4], nh: (r[5] & 1) === 1, nl: (r[5] & 2) === 2 };
}

/**
 * 종목 정보 한 줄에 장중 값 — 가격 · 오늘 등락 · 거래량 배수 · 52주 범위 · 신고가/신저가 · 시총/배당률(가격 비례),
 * 후보 · 보유면 RSI · 5일 · 52주 위치 · 이동평균 갭 · 예고 · 과열 기준. 새 객체를 돌려준다 (캐시된 밤 데이터는 그대로).
 */
export function overlayInfo<T extends TickerInfo>(info: T, q: Quote | null, c: LiveCand | null | undefined,
  mark: LiveMark): T {
  if (!q && !c) return info;
  const out: T = { ...info, live: mark };
  if (q) {
    const scale = info.price ? q.p / info.price : null;
    out.live_scale = scale; // 지금 가격 ÷ 밤 가격 — PER 등 가격에 비례하는 값을 맞출 때
    out.price = q.p;
    if (q.c != null) out.ret_1d = q.c;
    if (q.v != null) out.vol_ratio = q.v;
    if (q.lo != null && q.hi != null) out.range_52w = { low: q.lo, high: q.hi };
    if (q.lo != null) {
      out.new_high = q.nh;
      out.new_low = q.nl;
    }
    const f = info.fundamentals;
    if (f && scale) {
      out.fundamentals = {
        ...f,
        market_cap: f.market_cap != null ? f.market_cap * scale : f.market_cap,
        dividend_yield: f.annual_dividend != null && f.annual_dividend > 0 ? f.annual_dividend / q.p : f.dividend_yield,
      };
    }
  }
  if (c) {
    out.rsi = c.rsi ?? out.rsi;
    out.ret_5d = c.ret_5d ?? out.ret_5d;
    out.position_52w = c.position_52w ?? out.position_52w;
    out.vol_ratio = c.vol_ratio ?? out.vol_ratio;
    out.ma_gap = c.ma_gap;
    out.preview = c.preview;
    out.live_heat = c.heat;
  }
  return out;
}
