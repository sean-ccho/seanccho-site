import { getLiveMark, getLiveVia } from "@/lib/live";

/**
 * 장중 새로고침 확인용 (2026-11-09, components/LiveRefresher) — 지금 장중 펄스의 시각만 (수십 바이트).
 * 브라우저가 장중에 30초마다 묻고, 페이지를 그린 펄스 시각과 다르면 router.refresh() 한다 (새 펄스 · 펄스 끊김 둘 다).
 * CDN 이 10초 같이 써서 여러 탭 · 방문자가 물어도 함수는 거의 안 돈다.
 * via = 펄스 파일을 어디서 읽었나 (api = 토큰 · 바로, raw = 토큰 없음 · 실패 → 0~5분 늦음) — 비밀 값은 없다.
 */
export async function GET(): Promise<Response> {
  const [mark, via] = await Promise.all([getLiveMark(), getLiveVia()]);
  return Response.json(
    { stamp: mark?.stamp ?? null, state: mark?.state ?? null, via },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=10" } },
  );
}
