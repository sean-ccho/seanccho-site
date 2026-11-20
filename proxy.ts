import { NextResponse, type NextRequest } from "next/server";
import { isAdminPath, loginHref } from "@/lib/authPaths";
import { isLang, LANG_COOKIE } from "@/lib/langCode";
import { carryAuth, updateSession } from "@/lib/supabase/proxy";

/**
 * 언어 링크 (2026-11-19) — '?lang=en' · '?lang=ko' 가 붙은 주소는 그 언어를 쿠키에 1년 저장하고 같은 주소(lang 뺀)로 다시 보낸다.
 * 링크드인 · 이력서에 'https://…/quant?lang=en' 을 걸면 누가 열어도 영어로. 주소에 남겨 두면 KO|EN 버튼을 눌러도
 * 새로 그릴 때마다 lang 이 다시 덮어써서, 쿠키만 남기고 주소에서는 뺀다. 이상한 값(lang=fr)은 그냥 뺀다.
 */
function langLink(request: NextRequest, value: string): NextResponse {
  const url = request.nextUrl.clone();
  url.searchParams.delete("lang");
  const res = NextResponse.redirect(url);
  if (isLang(value)) res.cookies.set(LANG_COOKIE, value, { maxAge: 31_536_000, path: "/", sameSite: "lax" });
  return res;
}

/**
 * 모든 페이지 요청 앞 (2026-11-20 구글 로그인으로 바꿈 — 그 전엔 SITE_PASSWORD 브라우저 로그인 창).
 * ① '?lang=' 링크 ② 로그인 쿠키 확인 · 만료 토큰 갱신 (lib/supabase/proxy.ts — 쿠키 없는 방문자는 그냥 통과)
 * ③ 관리자 화면(내계좌 · 관심종목 · 관리)인데 로그인 안 했으면 로그인 화면으로 (끝나면 다시 이 주소로).
 * 관리자인지는 여기서 안 본다 — 페이지 · 서버 액션이 lib/viewer.ts 로 DB 등급을 확인한다 (여기는 1차 거름망).
 * 저장 버튼(서버 액션 POST)은 보내지 않고 통과 — 액션이 직접 거절하고 '관리자 로그인' 안내를 돌려준다.
 */
export async function proxy(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("lang");
  if (lang !== null && request.method === "GET") return langLink(request, lang);
  const { response, userId } = await updateSession(request);
  if (userId || !isAdminPath(request.nextUrl.pathname)) return response;
  if (request.method !== "GET" && request.method !== "HEAD") return response;
  const to = new URL(loginHref(request.nextUrl.pathname + request.nextUrl.search), request.url);
  return carryAuth(response, NextResponse.redirect(to));
}

export const config = {
  matcher: [
    // 페이지 전부 — Next 내부 파일 · api · 아이콘 · 링크 미리보기 그림 · 정적 파일은 빼고
    // (api 는 로그인과 상관없고, ?lang= 도 api 는 따로 받는다)
    "/((?!_next/static|_next/image|api/|favicon\\.ico|icon\\.svg|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|json|woff2?)$).*)",
  ],
};
