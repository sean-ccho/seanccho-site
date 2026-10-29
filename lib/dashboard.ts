import { readFile } from "node:fs/promises";
import type { ChartImages, Dashboard, Fundamentals, GoldenTf, TickerInfo } from "./types";

// Project_1 의 CI 가 매일 덮어쓰는 파일. 이 리포와 Project_1 은 배포가 서로 엮이지 않는다.
export const DEFAULT_DASHBOARD_URL =
  "https://raw.githubusercontent.com/sean-ccho/Project_1/dashboard-data/dashboard.json";

/** dashboard.json 캐시 태그 — /api/revalidate 가 이 태그로 비운다. */
export const DASHBOARD_TAG = "dashboard";

/**
 * dashboard.json 을 읽는다. 못 읽으면 null (페이지는 '데이터 없음' 안내를 보여 준다).
 * DASHBOARD_FILE 이 있으면 로컬 파일, 아니면 DASHBOARD_URL(기본: GitHub raw)을 받는다.
 * 보통은 Project_1 CI 가 실행 끝에 /api/revalidate 를 불러 바로 새로 받고, 그게 실패해도 30분마다 새로 받는다.
 */
export async function getDashboard(): Promise<Dashboard | null> {
  try {
    const file = process.env.DASHBOARD_FILE;
    if (file) {
      return JSON.parse(await readFile(file, "utf8")) as Dashboard;
    }
    const res = await fetch(process.env.DASHBOARD_URL || DEFAULT_DASHBOARD_URL, {
      next: { revalidate: 1800, tags: [DASHBOARD_TAG] },
    });
    if (!res.ok) {
      console.error(`[dashboard] ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as Dashboard;
  } catch (err) {
    console.error("[dashboard] 읽기 실패", err);
    return null;
  }
}

/** 종목 정보 — stocks(새 형식) → 후보 → 차트 항목 순으로 찾는다. 없으면 null. */
export function stockInfo(data: Dashboard, ticker: string): TickerInfo | null {
  const fromStocks = data.stocks?.[ticker];
  if (fromStocks) return fromStocks;
  const cand = data.candidates.find((c) => c.ticker === ticker);
  if (cand) return cand;
  for (const market of data.charts) {
    const item = market.items.find((it) => it.ticker === ticker && it.info);
    if (item?.info) return item.info;
  }
  return null;
}

/** 티커 → 차트 이미지 주소 (두 시장 합쳐서). 차트추천에 없으면 전체차트 캡처로. */
export function chartIndex(data: Dashboard): Record<string, ChartImages> {
  const out: Record<string, ChartImages> = {};
  for (const market of [...data.charts, ...(data.all_charts ?? [])]) {
    for (const item of market.items) {
      if (!out[item.ticker]) out[item.ticker] = item.images;
    }
  }
  return out;
}

/** 후보·차트 화면의 종목 한 줄 (세 페이지가 같은 모양으로 넘긴다). */
export type ScreenRow = {
  ticker: string;
  held: boolean;
  market: string | null; // "sp500" | "nasdaq"
  info: TickerInfo | null;
  images: ChartImages | undefined;
};

/** 재무는 화면에 쓰는 여섯 개만 남긴다 (차트 페이지는 종목이 수백 개라 브라우저로 보내는 양 줄이기). */
export function slimInfo(info: TickerInfo | null): TickerInfo | null {
  const f = info?.fundamentals;
  if (!info || !f) return info;
  const keep = {
    revenue_growth: f.revenue_growth,
    earnings_growth: f.earnings_growth,
    profit_margin: f.profit_margin,
    market_cap: f.market_cap,
    dividend_yield: f.dividend_yield, // 종목 칸 배당 줄 · 배당률 정렬
    annual_dividend: f.annual_dividend,
  } as Fundamentals;
  return { ...info, fundamentals: keep };
}

/** 시장별 차트 목록 → 한 줄씩 (두 시장에 다 있으면 앞의 것). */
export function marketRows(
  markets: { key: string; items: { ticker: string; held: boolean; images: ChartImages }[] }[],
  infoOf: (ticker: string) => TickerInfo | null,
): ScreenRow[] {
  const seen = new Set<string>();
  const out: ScreenRow[] = [];
  for (const m of markets) {
    for (const it of m.items) {
      if (seen.has(it.ticker)) continue;
      seen.add(it.ticker);
      out.push({ ticker: it.ticker, held: it.held, market: m.key, info: slimInfo(infoOf(it.ticker)), images: it.images });
    }
  }
  return out;
}

/** 시장별 PT 골든크로스 목록 + 종목 이름·점수·거래량 + 그 화면 목록에 있는지. */
export function goldenLists(data: Dashboard, listed: Set<string>): GoldenList[] {
  return Object.entries(data.golden_cross ?? {}).map(([market, items]) => ({
    market,
    items: items.map((g) => {
      const info = stockInfo(data, g.ticker);
      return {
        ticker: g.ticker,
        company: info?.company ?? null,
        timeframes: g.timeframes,
        score: info?.score ?? null,
        vol_ratio: info?.vol_ratio ?? null,
        listed: listed.has(g.ticker),
      };
    }),
  }));
}

export type GoldenRow = {
  ticker: string;
  company: string | null;
  timeframes: GoldenTf[];
  score: number | null;
  vol_ratio: number | null;
  listed: boolean;
};
export type GoldenList = { market: string; items: GoldenRow[] };

/** 가장 최근 차트 캡처 시각 (markets 를 안 주면 차트추천 기준). */
export function latestCapture(data: Dashboard, markets: { captured_at: string | null }[] = data.charts): string | null {
  const stamps = markets.map((m) => m.captured_at).filter((s): s is string => Boolean(s));
  return stamps.length ? stamps.sort().at(-1) ?? null : null;
}
