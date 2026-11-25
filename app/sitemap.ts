import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";
import { UNIVERSE_KEYS } from "@/lib/universe";
import { getUniverseMarketServerNight } from "@/lib/universeServer";

/**
 * sitemap.xml (2026-11-25 검색 노출) — 구글에 '이 사이트에 이런 페이지들이 있다' 목록. 공개 메뉴 화면 + 전체분석의 모든 종목 페이지
 * (S&P 500 · 나스닥 · NYSE · 신규 상장 · 번외 · 캐나다). 하루 한 번 새로 만든다. 시장 파일을 못 읽으면 메뉴 화면만.
 */
export const revalidate = 86400;

/** 로그인 없이 보이는 메뉴 화면 (관리자 화면은 넣지 않는다 — app/robots.ts). */
const PAGES = [
  "/quant",
  "/quant/candidates",
  "/quant/charts",
  "/quant/charts/all",
  "/quant/universe",
  "/quant/etf",
  "/quant/sectors",
  "/quant/congress",
  "/quant/model",
];

const TICKER = /^[A-Z0-9.-]{1,12}$/; // 종목 페이지가 받는 모양 (lib/universeServer.ts readStockFile 과 같게)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const markets = await Promise.all(UNIVERSE_KEYS.map((k) => getUniverseMarketServerNight(k)));
  const stocks = new Map<string, string | undefined>(); // 티커 → 그 시장 파일의 마지막 봉 날짜
  for (const m of markets) {
    if (!m) continue;
    for (const t of Object.keys(m.items ?? {})) {
      if (TICKER.test(t) && !stocks.has(t)) stocks.set(t, m.bar_date || undefined);
    }
  }
  return [
    ...PAGES.map((p) => ({
      url: `${SITE_URL}${p}`,
      changeFrequency: "daily" as const,
      priority: p === "/quant" ? 1 : 0.8,
    })),
    ...[...stocks].sort(([a], [b]) => a.localeCompare(b)).map(([t, date]) => ({
      url: `${SITE_URL}/quant/stock/${encodeURIComponent(t)}`,
      lastModified: date,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
