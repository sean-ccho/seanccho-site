import { NextResponse, type NextRequest } from "next/server";
import { basicAuthOk } from "@/lib/auth";
import { isLang, LANG_COOKIE } from "@/lib/langCode";

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
 * 내계좌(/quant/account)·관심종목(/quant/watchlist)·관리(/quant/admin) 비밀번호. 예측 모델은 2026-11-17 부터 공개. 환경변수 SITE_PASSWORD 를 브라우저 기본 로그인 창으로 묻는다 — 아이디는 아무거나.
 * SITE_PASSWORD 가 없으면 내계좌는 아예 열리지 않는다 (실제 돈 정보라서). 다른 /quant 페이지는 공개.
 * 저장 버튼(서버 액션)도 같은 비밀번호를 한 번 더 확인한다 — app/quant/account/actions.ts.
 */
export function proxy(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("lang");
  if (lang !== null && request.method === "GET") return langLink(request, lang);
  const path = request.nextUrl.pathname;
  if (!PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) return NextResponse.next();
  const password = process.env.SITE_PASSWORD;
  if (!password) {
    return new NextResponse("SITE_PASSWORD is not set — 내계좌는 Vercel 에 SITE_PASSWORD 를 넣어야 열립니다.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (basicAuthOk(request.headers.get("authorization"), password)) {
    // 사이트 주인 표시 (2026-11-05) — 이 브라우저의 방문은 방문자 집계에서 뺀다 (components/VisitTracker.tsx · /api/visit).
    // 화면 스크립트가 읽어야 해서 httpOnly 가 아니다. 값은 '1' 뿐이라 비밀이 없다 — 지워지면 비밀번호 화면을 한 번 더 열면 된다.
    const res = NextResponse.next();
    res.cookies.set("sc_owner", "1", { maxAge: 400 * 86_400, path: "/", sameSite: "lax", secure: true });
    return res;
  }
  // 로그인 창은 주소창·링크로 이 페이지를 직접 열 때(Sec-Fetch-Mode: navigate)만 띄운다. 미리 읽기·화면 안 이동 같은
  // 뒤에서 하는 요청에 띄우면 다른 페이지를 보는 중에도 로그인 창이 화면을 막는다 (Next 는 rsc 헤더를 proxy 에
  // 넘기지 않아 그걸로는 구분 못 한다). 뒤에서 거절당하면 Next 가 이 주소로 직접 다시 들어오고, 그때 묻는다.
  const navigate = (request.headers.get("sec-fetch-mode") ?? "navigate") === "navigate";
  return new NextResponse("비밀번호가 필요합니다 · Password required", {
    status: 401,
    headers: navigate
      ? { "WWW-Authenticate": 'Basic realm="account", charset="UTF-8"', "content-type": "text/plain; charset=utf-8" }
      : { "content-type": "text/plain; charset=utf-8" },
  });
}

/** 비밀번호 주소 — 아래 matcher 와 같은 목록 (matcher 는 상수만 받아서 두 번 적는다). */
const PROTECTED = ["/quant/account", "/quant/watchlist", "/quant/admin"];

export const config = {
  matcher: [
    "/quant/account", "/quant/account/:path*",
    "/quant/watchlist", "/quant/watchlist/:path*",
    // 관리 · 파이프라인 (2026-11-04) — 작업 실행 기록 · 본인만
    "/quant/admin", "/quant/admin/:path*",
    // 예측 모델은 2026-11-17 부터 공개 (사용자: "암호는 빼줘" — 리서치 출처 이름을 다 지운 뒤)
    // 언어 링크 '?lang=' 이 붙은 주소만 (다른 요청엔 proxy 가 돌지 않는다) — _next 파일 · api 는 빼고 (api 는 ?lang= 을 따로 받는다)
    { source: "/((?!_next/|api/).*)", has: [{ type: "query", key: "lang" }] },
  ],
};
