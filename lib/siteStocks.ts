import { slimInfo, stockInfo } from "./dashboard";
import type { Dashboard, TickerInfo } from "./types";
import { getUniverseStock } from "./universeServer";

// 내계좌·관심종목 줄의 종목 정보 — 시트 '현재가'는 밤 파이프라인이 채우기 전까지 비어 있다 (웹에서 막 넣은 줄).
// 그동안은 사이트가 가진 마지막 종가를 쓴다: dashboard.json 종목 먼저, 없으면 전체분석 종목 파일 (S&P 500·나스닥·NYSE).

/** 티커 → 종목 정보 (가격·회사·차트 신호). 어디에도 없는 종목(TSXV 등)은 빠진다. */
export async function siteStocks(data: Dashboard | null, tickers: string[]): Promise<Record<string, TickerInfo>> {
  const uniq = [...new Set(tickers.map((t) => t.toUpperCase()))];
  const found = await Promise.all(uniq.map(async (tk) => {
    const info = (data && stockInfo(data, tk)) ?? (await getUniverseStock(tk));
    return [tk, slimInfo(info)] as const;
  }));
  return Object.fromEntries(found.filter((x): x is [string, TickerInfo] => x[1] != null));
}
