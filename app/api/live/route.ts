import { getLiveData, liveMark } from "@/lib/live";

/**
 * 장중 새로고침 확인용 (2026-11-09, components/LiveRefresher) — 지금 장중 펄스의 시각만 (수십 바이트).
 * 브라우저가 장중에 90초마다 묻고, 페이지를 그린 펄스 시각과 다르면 router.refresh() 한다 (새 펄스 · 펄스 끊김 둘 다).
 * CDN 이 30초 같이 써서 여러 탭 · 방문자가 물어도 함수는 거의 안 돈다.
 */
export async function GET(): Promise<Response> {
  const mark = liveMark(await getLiveData());
  return Response.json(
    { stamp: mark?.stamp ?? null, state: mark?.state ?? null },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=30" } },
  );
}
