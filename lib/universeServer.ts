import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { DASHBOARD_TAG } from "./dashboard";
import type { CongressTickersFile } from "./congress";
import type {
  CongressFeed, CongressTrade, IndVal, MarketSummary, StockDetail, TickerInfo, UniverseKey, UniverseMarket,
} from "./types";
import { isCadListing } from "./format";
import { CANADA_BASE, UNIVERSE_BASE, UNIVERSE_KEYS, universeBase } from "./universe";
import { getLiveData, getLiveMark, getLiveQuotes, liveInfo, newer, overlayInfo, overlayMarket, quoteOf } from "./live";

type StockFile = {
  schema: number;
  bar_date: string | null;
  market: string;
  ticker: string;
  info: TickerInfo;
  about?: string | null; // 회사 소개 (영어, yfinance) — 2026-10-28 부터
  detail?: StockDetail | null; // 밸류에이션 · 애널리스트 · 분기 실적 (2026-11-03)
  congress?: CongressTrade[]; // 국회의원 거래 신고 12개월 (2026-11-06) — 거래가 있는 종목에만
};

/**
 * 종목 상세의 '투자자 한눈에' 재료 — 전체분석 종목 파일의 기준일 · 종목 정보(하루 · 3달 · 1년 수익률, 52주 범위) ·
 * detail(밸류에이션 · 애널리스트 · 분기 실적) · congress(국회의원 거래 12개월). dashboard 종목도 같은 밤 일봉 기준이라
 * 여기 숫자를 쓴다. 없으면 null.
 */
export async function getUniverseExtras(
  ticker: string,
): Promise<{
  barDate: string | null; market: string; info: TickerInfo; detail: StockDetail | null; congress: CongressTrade[];
} | null> {
  const f = await readStockFile(ticker);
  if (!f) return null;
  // 장중(2026-11-09)이면 하루 등락 · 52주 범위 · 가격을 장중 펄스 값으로 (lib/live.ts)
  return { barDate: f.bar_date, market: f.market, info: await liveInfo(f.info, ticker, f.bar_date),
    detail: f.detail ?? null, congress: f.congress ?? [] };
}

/**
 * 밸류에이션 '다른 업종과 비교' (2026-11-09) — 그 시장 market.json 의 ind_val (업종 전부 · 섹터 · 시장 전체 중앙값, 약 20KB).
 * 종목 파일 market 이 'ca' 면 캐나다 (업종 중앙값도 캐나다 종목끼리 낸 것). 없거나(예전 파일) 못 읽으면 null — 고르기가 안 보인다.
 */
export async function getIndVal(market: string | null | undefined): Promise<IndVal | null> {
  return (await getMarketSummaryNight(market === "ca" ? "ca" : "us"))?.ind_val ?? null;
}

/**
 * 오늘 탭 '최근 국회의원 거래 신고' — universe-data 의 congress.json (Project_1 universe-scan 이 밤마다, 2026-11-06).
 * UNIVERSE_DIR 이 있으면 로컬 폴더. 없거나 못 읽으면 null (그 칸 · 종목 카드가 안 보인다).
 */
export async function getCongressFeed(): Promise<CongressFeed | null> {
  try {
    const dir = process.env.UNIVERSE_DIR;
    if (dir) return JSON.parse(await readFile(path.join(dir, "congress.json"), "utf8")) as CongressFeed;
    const res = await fetch(`${UNIVERSE_BASE}/congress.json`, { next: { revalidate: 1800, tags: [DASHBOARD_TAG] } });
    if (!res.ok) return null;
    return (await res.json()) as CongressFeed;
  } catch {
    return null;
  }
}

/**
 * 국회의원 거래 화면(/quant/congress) — universe-data 의 congress_tickers.json (종목별 1년 거래, 약 1.4MB).
 * 화면은 compactCongress 로 줄여서 넘긴다. 없거나 못 읽으면 null.
 */
export async function getCongressTickers(): Promise<CongressTickersFile | null> {
  try {
    const dir = process.env.UNIVERSE_DIR;
    if (dir) return JSON.parse(await readFile(path.join(dir, "congress_tickers.json"), "utf8")) as CongressTickersFile;
    const res = await fetch(`${UNIVERSE_BASE}/congress_tickers.json`, { next: { revalidate: 1800, tags: [DASHBOARD_TAG] } });
    if (!res.ok) return null;
    return (await res.json()) as CongressTickersFile;
  } catch {
    return null;
  }
}

/**
 * 오늘 탭 '시장 한눈에' · '실적 발표 일정' — 전체분석이 시장 파일과 같이 쓰는 작은 요약 (약 10KB).
 * 미국 = universe-data 의 market.json, 캐나다 = canada-data 의 market.json (2026-11-06, Canada Scan).
 * UNIVERSE_DIR 이 있으면 로컬 폴더의 market.json · market_ca.json. 없거나 못 읽으면 null (그 칸 · 그 시장만 안 보인다).
 */
export async function getMarketSummary(key: "us" | "ca" = "us"): Promise<MarketSummary | null> {
  const night = await getMarketSummaryNight(key);
  if (!night) return null;
  // 장중(2026-11-09)이면 시장 폭 · 많이 오른/내린/거래량 급증 · 섹터를 장중 펄스 값으로 (실적 일정은 밤 그대로)
  const [live, mark] = await Promise.all([getLiveData(), getLiveMark()]);
  return overlayMarket(night, live, mark);
}

async function getMarketSummaryNight(key: "us" | "ca"): Promise<MarketSummary | null> {
  try {
    const dir = process.env.UNIVERSE_DIR;
    if (dir) return JSON.parse(await readFile(path.join(dir, key === "ca" ? "market_ca.json" : "market.json"), "utf8")) as MarketSummary;
    // 로컬에서 NEXT_PUBLIC_UNIVERSE_BASE 만 주면 두 주소가 같다 — 그때 캐나다는 없음 (미국 파일을 캐나다로 보이지 않게)
    if (key === "ca" && CANADA_BASE === UNIVERSE_BASE) return null;
    const base = key === "ca" ? CANADA_BASE : UNIVERSE_BASE;
    const res = await fetch(`${base}/market.json`, { next: { revalidate: 1800, tags: [DASHBOARD_TAG] } });
    if (!res.ok) return null;
    const m = (await res.json()) as MarketSummary;
    return (m.market ?? "us") === key ? m : null;
  } catch {
    return null;
  }
}

/**
 * 종목 상세 페이지용 전체분석 한 종목 (dashboard.json 에 없는 종목일 때). dashboard 와 같은 태그로 캐시한다
 * (Project_1 CI 가 /api/revalidate 로 같이 비운다). 없거나 못 읽으면 null. UNIVERSE_DIR 이 있으면 로컬 폴더에서.
 * 장중(2026-11-09)이면 가격 · 하루 등락 · 52주 범위를 장중 펄스 값으로.
 */
export async function getUniverseStock(ticker: string): Promise<TickerInfo | null> {
  const f = await readStockFile(ticker);
  return f ? await liveInfo(f.info, ticker, f.bar_date) : null;
}

/** 회사 소개 (영어 원문). 전체분석 종목 파일에만 있다 — 없거나 못 읽으면 null. */
export async function getUniverseAbout(ticker: string): Promise<string | null> {
  return (await readStockFile(ticker))?.about ?? null;
}

/** 그 종목이 든 전체분석 시장 파일 (sp500 · nasdaq · new · extra · ca). 없으면 null — 전체분석 ?t= 가 탭을 고를 때. */
export async function getUniverseMarket(ticker: string): Promise<UniverseKey | null> {
  const market = (await readStockFile(ticker))?.market;
  return UNIVERSE_KEYS.includes(market as UniverseKey) ? (market as UniverseKey) : null;
}

/**
 * 종목 파일 — universe-data 먼저, 없고 캐나다 상장(.TO · .V)이면 canada-data (2026-11-05). 번외 종목(캐나다 상장이어도)은
 * universe-data 에 있어서 번외 탭이 열린다. UNIVERSE_DIR(로컬)은 두 브랜치 파일을 한 폴더에 둔다.
 */
async function readStockFile(ticker: string): Promise<StockFile | null> {
  if (!/^[A-Z0-9.-]{1,12}$/.test(ticker)) return null;
  const dir = process.env.UNIVERSE_DIR;
  if (dir) {
    try {
      return JSON.parse(await readFile(path.join(dir, "stocks", `${ticker}.json`), "utf8")) as StockFile;
    } catch {
      return null;
    }
  }
  const bases = isCadListing(ticker) && CANADA_BASE !== UNIVERSE_BASE ? [UNIVERSE_BASE, CANADA_BASE] : [UNIVERSE_BASE];
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/stocks/${encodeURIComponent(ticker)}.json`, {
        next: { revalidate: 1800, tags: [DASHBOARD_TAG] },
      });
      if (res.ok) return (await res.json()) as StockFile;
    } catch {
      // 다음 곳
    }
  }
  return null;
}

/**
 * 시장 파일이 있는지만 (탭 보이기 — 캐나다는 Project_1 이 빈 파일을 올리지 않는다). getUniverseMarketServer 와 같은 주소 ·
 * 캐시라 내용을 두 번 받지 않는다.
 */
export async function hasUniverseFile(key: UniverseKey): Promise<boolean> {
  try {
    const dir = process.env.UNIVERSE_DIR;
    if (dir) {
      await readFile(path.join(dir, `${key}.json`));
      return true;
    }
    const res = await fetch(`${universeBase(key)}/${key}.json.gz`, { next: { revalidate: 1800, tags: [DASHBOARD_TAG] } });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 전체분석 시장 파일 하나 (서버 — 섹터 지도). .json.gz 로 받아 푼다 (S&P 500 약 0.4MB — 서버 캐시 한도 2MB 안).
 * UNIVERSE_DIR 이 있으면 로컬 폴더의 {key}.json. 못 읽으면 null.
 */
export async function getUniverseMarketServer(key: UniverseKey): Promise<UniverseMarket | null> {
  const m = await getUniverseMarketServerNight(key);
  if (!m) return null;
  // 장중(2026-11-09) — 시세가 있는 종목은 가격 · 하루 등락 · 52주 범위를 장중 값으로 (섹터 지도 대표 종목 가격 등)
  const [live, quotes, mark] = await Promise.all([getLiveData(), getLiveQuotes(), getLiveMark()]);
  if (!live || !quotes || !newer(mark, m.bar_date)) return m;
  return {
    ...m,
    items: Object.fromEntries(Object.entries(m.items).map(([t, info]) => {
      const q = quoteOf(quotes, t);
      return [t, q ? overlayInfo(info, q, null, mark) : info];
    })),
  };
}

async function getUniverseMarketServerNight(key: UniverseKey): Promise<UniverseMarket | null> {
  try {
    const dir = process.env.UNIVERSE_DIR;
    if (dir) return JSON.parse(await readFile(path.join(dir, `${key}.json`), "utf8")) as UniverseMarket;
    const res = await fetch(`${universeBase(key)}/${key}.json.gz`, { next: { revalidate: 1800, tags: [DASHBOARD_TAG] } });
    if (!res.ok) return null;
    return JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8")) as UniverseMarket;
  } catch (err) {
    console.error(`[universe] ${key} 읽기 실패`, err);
    return null;
  }
}
