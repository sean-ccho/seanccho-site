import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * 구글 로그인(Supabase) 연결 정보 (2026-11-20). Vercel 환경변수 두 개가 다 있어야 로그인이 켜진다.
 * 둘 다 공개 값이라 NEXT_PUBLIC_ 이름(Supabase · Vercel 연동이 쓰는 이름)이지만, 브라우저 코드에서는 쓰지 않는다 —
 * 로그인 · 토큰 갱신은 전부 서버(proxy · 서버 액션 · route handler)에서만 한다.
 * 키는 새 publishable 키를 먼저, 없으면 예전 anon 키.
 */
export type SupabaseEnv = { url: string; key: string };

export function supabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/**
 * 로그인 쿠키 설정 — httpOnly: 브라우저 스크립트가 토큰을 읽을 일이 없으니 막아 둔다 (XSS 로 토큰을 못 훔치게).
 * Vercel(운영 · 미리보기)은 늘 https 라 secure. 내 Mac 의 http://localhost 확인 때만 secure 를 뺀다.
 */
export const AUTH_COOKIE_OPTIONS: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.VERCEL === "1",
};

/**
 * Supabase 요청은 Next 데이터 캐시에 절대 안 남게 (cache: no-store) — 로그인 · 회원 정보가 캐시돼 다른 사람 화면에 나오면 안 된다.
 * (지금도 쿠키를 읽은 뒤라 요청마다 새로 받지만, 페이지의 revalidate 설정이 바뀌어도 안전하게 못 박아 둔다.)
 */
export const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

/** Supabase 로그인 쿠키(sb-…)가 하나라도 있나 — 없으면(방문자 대부분) Supabase 를 부를 필요가 없다. */
export function hasAuthCookie(cookies: { name: string }[]): boolean {
  return cookies.some((c) => c.name.startsWith("sb-"));
}
