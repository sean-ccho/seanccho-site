import type { NextRequest } from "next/server";
import { sentences, type About } from "@/lib/about";
import { getEtfDetail } from "@/lib/etf";
import { translateKo } from "@/lib/translate";

/**
 * ETF 줄을 펼치면 부르는 주소 — 상세는 ETF 마다 몇 KB 라 목록 파일(etf.json)에 안 싣는다 (2026-10-29).
 *
 *   GET /api/etf/VOO?lang=ko   →  { detail, about }   (detail 이 없으면 null — 밤 실행 전 · 못 받은 ETF)
 *
 * about = 설명의 영어 원문 + 문장마다 기계번역 (회사 소개와 같은 방식). 보유 비중은 매일 조금씩 바뀌니 6시간 캐시, 번역이 막혔으면 짧게.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ ticker: string }> }): Promise<Response> {
  const ticker = decodeURIComponent((await ctx.params).ticker).trim().toUpperCase();
  const lang = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "ko";
  const detail = await getEtfDetail(ticker);
  let about: About | null = null;
  if (detail?.desc) {
    const ko = lang === "ko" ? await translateKo(sentences(detail.desc)) : null;
    about = { en: detail.desc, ko: ko ? ko.join(" ") : null };
  }
  const full = detail && (!about || lang === "en" || about.ko);
  return Response.json({ detail, about }, {
    headers: {
      "Cache-Control": full ? "public, s-maxage=21600, stale-while-revalidate=86400" : "public, s-maxage=600",
    },
  });
}
