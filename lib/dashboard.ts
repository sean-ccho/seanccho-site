import { readFile } from "node:fs/promises";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getLiveData, getLiveMark, getLiveQuotes, overlayDashboard } from "./live";
import type { ChartImages, Dashboard, DashboardCore, Fundamentals, GoldenTf, TickerInfo } from "./types";

// Project_1 의 CI 가 매일 덮어쓰는 파일. 이 리포와 Project_1 은 배포가 서로 엮이지 않는다.
export const DEFAULT_DASHBOARD_URL =
  "https://raw.githubusercontent.com/sean-ccho/Project_1/dashboard-data/dashboard.json";

/** dashboard.json 캐시 태그 — /api/revalidate 가 이 태그로 비운다. */
export const DASHBOARD_TAG = "dashboard";

/** 맨 위 머리(상태 줄 · 시세 줄)에 안 쓰는 큰 칸 — 따로 캐시한다. */
const BIG_KEYS: readonly string[] = ["stocks", "charts", "all_charts"];

function corePart(d: Dashboard): DashboardCore {
  return Object.fromEntries(Object.entries(d).filter(([k]) => !BIG_KEYS.includes(k))) as DashboardCore;
}

async function fetchWhole(url: string): Promise<Dashboard> {
  const res = await fetch(url, { cache: "no-store" }); // 통째로는 캐시 한도를 넘는다 — 아래 조각 캐시가 대신
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as Dashboard;
}

// 조각 넷이 한꺼번에 비면 (밤 갱신 직후) 한 서버가 같은 파일을 한 번만 받게
const inflight = new Map<string, Promise<Dashboard>>();
function fetchShared(url: string): Promise<Dashboard> {
  let p = inflight.get(url);
  if (!p) {
    p = fetchWhole(url).finally(() => inflight.delete(url));
    inflight.set(url, p);
  }
  return p;
}

/**
 * dashboard.json 을 네 조각(머리용 core · stocks · charts · all_charts)으로 나눠 Next 데이터 캐시에 둔다 (2026-11-03).
 * 파일이 2MB 를 넘으면서(캐시엔 base64 로 2.65MB) 한도 2MB 에 걸려 통째로는 캐시가 안 됐고, 그래서 페이지를 볼 때마다
 * GitHub 에서 새로 받았다. 조각은 캐시 크기 0.23 · 0.90 · 0.79 · 0.27M 글자라 한도 아래 — GitHub 은 30분에 한 번,
 * 또는 Project_1 CI 가 /api/revalidate 를 부른 뒤 한 번만 받는다. 못 받으면 throw — 실패는 캐시하지 않는다.
 */
function cachedPart<T>(name: string, pick: (d: Dashboard) => T) {
  // react cache — 같은 요청 안에서 머리와 페이지가 같은 조각을 두 번 읽지 않게
  return cache(
    unstable_cache(async (url: string) => pick(await fetchShared(url)), ["dashboard-part", name], {
      revalidate: 1800,
      tags: [DASHBOARD_TAG],
    }),
  );
}

const coreCached = cachedPart("core", corePart);
const stocksCached = cachedPart("stocks", (d) => d.stocks ?? null);
const chartsCached = cachedPart("charts", (d) => d.charts ?? []);
const allChartsCached = cachedPart("all_charts", (d) => d.all_charts ?? null);

const readLocal = cache(async (file: string) => JSON.parse(await readFile(file, "utf8")) as Dashboard);
const dashboardUrl = () => process.env.DASHBOARD_URL || DEFAULT_DASHBOARD_URL;

/**
 * 맨 위 머리(상태 줄 · 시세 줄)처럼 큰 칸이 필요 없는 곳 — core 조각만 읽는다. 못 읽으면 null.
 * DASHBOARD_FILE 이 있으면 로컬 파일.
 */
export async function getDashboardCore(): Promise<DashboardCore | null> {
  try {
    const file = process.env.DASHBOARD_FILE;
    const core = file ? corePart(await readLocal(file)) : await coreCached(dashboardUrl());
    return await withLive(core);
  } catch (err) {
    console.error("[dashboard] 읽기 실패", err);
    return null;
  }
}

/** 장중(2026-11-09)이면 PT-1 · 후보 · 종목 가격 · SPY · 숏스퀴즈를 장중 펄스 값으로 (lib/live.ts — 새 객체, 캐시는 그대로). */
async function withLive<T extends DashboardCore & { stocks?: Record<string, TickerInfo> }>(d: T): Promise<T> {
  const [live, quotes, mark] = await Promise.all([getLiveData(), getLiveQuotes(), getLiveMark()]);
  return overlayDashboard(d, live, quotes, mark);
}

/**
 * dashboard.json 전부 (조각 넷을 모아서). 못 읽으면 null (페이지는 '데이터 없음' 안내를 보여 준다).
 * DASHBOARD_FILE 이 있으면 로컬 파일, 아니면 DASHBOARD_URL(기본: GitHub raw).
 * 보통은 Project_1 CI 가 실행 끝에 /api/revalidate 를 불러 바로 새로 받고, 그게 실패해도 30분마다 새로 받는다.
 */
export async function getDashboard(): Promise<Dashboard | null> {
  try {
    const file = process.env.DASHBOARD_FILE;
    if (file) return await withLive(await readLocal(file));
    const url = dashboardUrl();
    const [core, stocks, charts, allCharts] = await Promise.all([
      coreCached(url),
      stocksCached(url),
      chartsCached(url),
      allChartsCached(url),
    ]);
    return await withLive({ ...core, charts, stocks: stocks ?? undefined, all_charts: allCharts ?? undefined });
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

/** 매수 후보 안쪽 탭 숫자 — 매수 후보 · 점수 상위 · 1차 선별 페이지 종목 수 (marketRows 처럼 두 시장에 다 있으면 한 번). 1차 선별 목록이 아직 없으면 null. */
export type FunnelCounts = { all: number | null; charts: number; candidates: number };

export function funnelCounts(data: Dashboard): FunnelCounts {
  const uniq = (markets: { items: { ticker: string }[] }[]) => new Set(markets.flatMap((m) => m.items.map((it) => it.ticker))).size;
  return { all: data.all_charts?.length ? uniq(data.all_charts) : null, charts: uniq(data.charts), candidates: data.candidates.length };
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
