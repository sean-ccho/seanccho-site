import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_OPTIONS, hasAuthCookie, noStoreFetch, supabaseEnv } from "./env";

export type SessionResult = {
  /** 이 응답을 그대로 돌려줘야 새 토큰 쿠키가 브라우저에 간다 (다른 응답을 쓰면 carryAuth 로 옮긴다). */
  response: NextResponse;
  /** 로그인한 사람의 id — 없으면 로그인 안 함 (쿠키가 없거나 · 가짜거나 · 만료돼 갱신도 실패). */
  userId: string | null;
};

/**
 * 로그인 쿠키 확인 · 갱신 (2026-11-20, Supabase 공식 방식). 페이지(Server Component)는 쿠키를 못 쓰니
 * 만료된 토큰은 여기서 새로 받아 요청(페이지가 읽을 쿠키)과 응답(브라우저에 저장) 둘 다에 쓴다.
 * - sb- 쿠키가 없으면(방문자 대부분) Supabase 를 아예 부르지 않는다.
 * - createServerClient 와 getClaims 사이에 다른 코드를 넣지 않는다 (공식 경고 — 끼면 가끔 이유 없이 로그아웃된다).
 * - setAll 이 주는 Cache-Control · Expires · Pragma 를 응답에 붙인다 — 새 토큰이 든 응답을 CDN 이 캐시해
 *   다른 사람에게 주면 그 사람이 내 계정으로 로그인된다.
 */
export async function updateSession(request: NextRequest): Promise<SessionResult> {
  let response = NextResponse.next({ request });
  const env = supabaseEnv();
  if (!env || !hasAuthCookie(request.cookies.getAll())) return { response, userId: null };
  const supabase = createServerClient(env.url, env.key, {
    global: { fetch: noStoreFetch },
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return { response, userId: typeof sub === "string" && sub ? sub : null };
}

/** updateSession 의 새 쿠키 · 캐시 막는 헤더를 다른 응답(로그인 화면으로 보내기 등)으로 옮긴다. */
export function carryAuth(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  for (const key of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(key);
    if (value) to.headers.set(key, value);
  }
  return to;
}
