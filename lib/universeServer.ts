import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { DASHBOARD_TAG } from "./dashboard";
import type { TickerInfo, UniverseKey, UniverseMarket } from "./types";
import { UNIVERSE_BASE, UNIVERSE_KEYS } from "./universe";

type StockFile = {
  schema: number;
  bar_date: string | null;
  market: string;
  ticker: string;
  info: TickerInfo;
  about?: string | null; // 회사 소개 (영어, yfinance) — 2026-10-28 부터
};

/**
 * 종목 상세 페이지용 전체분석 한 종목 (dashboard.json 에 없는 종목일 때). dashboard 와 같은 태그로 캐시한다
 * (Project_1 CI 가 /api/revalidate 로 같이 비운다). 없거나 못 읽으면 null. UNIVERSE_DIR 이 있으면 로컬 폴더에서.
 */
export async function getUniverseStock(ticker: string): Promise<TickerInfo | null> {
  return (await readStockFile(ticker))?.info ?? null;
}

/** 회사 소개 (영어 원문). 전체분석 종목 파일에만 있다 — 없거나 못 읽으면 null. */
export async function getUniverseAbout(ticker: string): Promise<string | null> {
  return (await readStockFile(ticker))?.about ?? null;
}

/** 그 종목이 든 전체분석 시장 파일 (sp500 · nasdaq · new). 없으면 null — 전체분석 ?t= 가 탭을 고를 때. */
export async function getUniverseMarket(ticker: string): Promise<UniverseKey | null> {
  const market = (await readStockFile(ticker))?.market;
  return UNIVERSE_KEYS.includes(market as UniverseKey) ? (market as UniverseKey) : null;
}

async function readStockFile(ticker: string): Promise<StockFile | null> {
  if (!/^[A-Z0-9.-]{1,12}$/.test(ticker)) return null;
  try {
    const dir = process.env.UNIVERSE_DIR;
    if (dir) {
      return JSON.parse(await readFile(path.join(dir, "stocks", `${ticker}.json`), "utf8")) as StockFile;
    }
    const res = await fetch(`${UNIVERSE_BASE}/stocks/${encodeURIComponent(ticker)}.json`, {
      next: { revalidate: 1800, tags: [DASHBOARD_TAG] },
    });
    if (!res.ok) return null;
    return (await res.json()) as StockFile;
  } catch {
    return null;
  }
}

/**
 * 전체분석 시장 파일 하나 (서버 — 섹터 지도). .json.gz 로 받아 푼다 (S&P 500 약 0.4MB — 서버 캐시 한도 2MB 안).
 * UNIVERSE_DIR 이 있으면 로컬 폴더의 {key}.json. 못 읽으면 null.
 */
export async function getUniverseMarketServer(key: UniverseKey): Promise<UniverseMarket | null> {
  try {
    const dir = process.env.UNIVERSE_DIR;
    if (dir) return JSON.parse(await readFile(path.join(dir, `${key}.json`), "utf8")) as UniverseMarket;
    const res = await fetch(`${UNIVERSE_BASE}/${key}.json.gz`, { next: { revalidate: 1800, tags: [DASHBOARD_TAG] } });
    if (!res.ok) return null;
    return JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8")) as UniverseMarket;
  } catch (err) {
    console.error(`[universe] ${key} 읽기 실패`, err);
    return null;
  }
}
