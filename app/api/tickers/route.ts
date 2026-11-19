import { getEtf } from "@/lib/etf";
import { UNIVERSE_KEYS } from "@/lib/universe";
import { getUniverseMarketServerNight } from "@/lib/universeServer";

/**
 * 종목 찾기(⌘K)용 목록 — [티커, 회사 이름, 시장] (2026-11-02). 전체분석 파일(S&P 500 · 나스닥·NYSE · 신규 상장 · 캐나다 ·
 * 번외 — 캐나다 · 번외 파일은 아직 없을 수 있다) + ETF 탭.
 * 약 7,500줄이라 하루 한 번 만들어 캐시한다 (가격·점수는 빼서 작게). Project_1 CI 가 /api/revalidate 를 부르면 전체분석 파일
 * fetch 캐시(DASHBOARD_TAG)와 함께 새로 만든다. 브라우저는 10분만 들고 있게 (전에는 1시간 — 새 시장이 늦게 보였다). 같은 티커는 앞 파일 것만.
 */
export const revalidate = 86400;

export async function GET() {
  // 밤 파일 그대로 (이름만 쓴다) — 장중 덮어쓰기(15초 캐시)를 거치면 이 목록이 15~60초마다 다시 만들어졌고, 나스닥 파일은
  // 2MB 를 넘어 fetch 캐시에도 못 들어가 그때마다 2.7MB 를 받아 12MB JSON 을 풀었다 (2026-11-18 Vercel 빌드 경고)
  const [markets, etf] = await Promise.all([Promise.all(UNIVERSE_KEYS.map(getUniverseMarketServerNight)), getEtf()]);
  const seen = new Set<string>();
  const out: [string, string, string][] = [];
  for (const m of markets) {
    if (!m) continue;
    for (const [ticker, info] of Object.entries(m.items)) {
      if (seen.has(ticker)) continue;
      seen.add(ticker);
      out.push([ticker, info.company ?? "", m.key]);
    }
  }
  for (const e of etf?.items ?? []) {
    if (seen.has(e.ticker)) continue;
    seen.add(e.ticker);
    out.push([e.ticker, e.name ?? "", "etf"]);
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return Response.json(out, {
    headers: { "Cache-Control": "public, max-age=600, s-maxage=86400, stale-while-revalidate=86400" },
  });
}
