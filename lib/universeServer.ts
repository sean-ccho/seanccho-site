import { readFile } from "node:fs/promises";
import path from "node:path";
import { DASHBOARD_TAG } from "./dashboard";
import type { TickerInfo, UniverseKey } from "./types";
import { UNIVERSE_BASE, UNIVERSE_KEYS } from "./universe";

type StockFile = { schema: number; bar_date: string | null; market: string; ticker: string; info: TickerInfo };

/**
 * 종목 상세 페이지용 전체분석 한 종목 (dashboard.json 에 없는 종목일 때). dashboard 와 같은 태그로 캐시한다
 * (Project_1 CI 가 /api/revalidate 로 같이 비운다). 없거나 못 읽으면 null. UNIVERSE_DIR 이 있으면 로컬 폴더에서.
 */
export async function getUniverseStock(ticker: string): Promise<TickerInfo | null> {
  return (await readStockFile(ticker))?.info ?? null;
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
