import type { NextRequest } from "next/server";
import { getAbout } from "@/lib/about";

/**
 * 차트 화면의 '회사 소개' 버튼이 부르는 주소 — 누를 때만 받는다 (소개가 종목마다 1~2천 자라 목록 파일에 안 싣는다).
 *
 *   GET /api/about/BSX?lang=ko   →  { en, ko }  (소개가 없으면 { en: null, ko: null })
 *
 * 소개는 거의 안 바뀌니 하루 캐시. 아직 없는 종목은 밤 실행 뒤 바로 보이게 짧게.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ ticker: string }> }): Promise<Response> {
  const ticker = decodeURIComponent((await ctx.params).ticker).trim().toUpperCase();
  const lang = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "ko";
  const about = await getAbout(ticker, lang);
  // 번역이 막혀 원문만 나간 응답도 짧게 — 풀리면 다음 요청이 번역을 받는다
  const full = about && (lang === "en" || about.ko);
  return Response.json(about ?? { en: null, ko: null }, {
    headers: {
      "Cache-Control": full ? "public, s-maxage=86400, stale-while-revalidate=604800" : "public, s-maxage=600",
    },
  });
}
