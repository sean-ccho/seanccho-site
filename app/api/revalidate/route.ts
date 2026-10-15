import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { DASHBOARD_TAG } from "@/lib/dashboard";

/**
 * Project_1 CI 가 dashboard.json 을 push 하고 부르는 주소. /quant 아래 페이지와 dashboard.json 캐시를 비워
 * 다음 방문 때 새 데이터로 다시 그리게 한다 (안 부르면 30분 자동 갱신만 — 캐시가 겹쳐 최대 1시간 늦다).
 *
 *   POST /api/revalidate   헤더 Authorization: Bearer <REVALIDATE_SECRET>
 *
 * 키는 Vercel 환경변수와 Project_1 GitHub Secret 의 REVALIDATE_SECRET (같은 값). 없거나 틀리면 401.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !sameText(given, secret)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  revalidateTag(DASHBOARD_TAG, { expire: 0 }); // 옛 데이터를 한 번도 더 보여 주지 않게 바로 만료
  revalidatePath("/quant", "layout"); // 오늘·후보·차트 세 페이지
  return Response.json({ ok: true, at: new Date().toISOString() });
}

/** 길이가 다르면 바로 false, 같으면 시간이 일정한 비교 (키를 한 글자씩 맞혀 보는 걸 막는다). */
function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
