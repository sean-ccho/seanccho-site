import { getLiveQuotes } from "@/lib/live";

/**
 * 전체분석 목록용 장중 시세 (2026-11-10, components/UniverseScreen) — 브라우저가 raw 에서 직접 받으면 GitHub CDN 5분 캐시로
 * 새 펄스가 늦게 보여서, 서버가 토큰으로 읽은 quotes.json 을 그대로 넘긴다 (약 250KB, 압축되어 나간다).
 * CDN 10초 — 방문자가 많아도 함수는 거의 안 돈다. 펄스가 없으면 null.
 */
export async function GET(): Promise<Response> {
  return Response.json(await getLiveQuotes(), {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=20" },
  });
}
