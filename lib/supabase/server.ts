import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_COOKIE_OPTIONS, noStoreFetch, supabaseEnv } from "./env";

/**
 * 서버(페이지 · 서버 액션 · route handler)용 Supabase (2026-11-20). 요청마다 새로 만든다 — 쿠키가 요청마다 다르고,
 * 한 번 만든 걸 다른 요청에 쓰면 캐시 막는 헤더가 빠진다 (@supabase/ssr 설명).
 * 로그인이 꺼져 있으면(환경변수 없음) null.
 */
export async function createSupabase() {
  const env = supabaseEnv();
  if (!env) return null;
  const jar = await cookies();
  return createServerClient(env.url, env.key, {
    global: { fetch: noStoreFetch },
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => jar.getAll(),
      setAll(list) {
        // 페이지(Server Component)는 쿠키를 못 쓴다 — 만료 토큰 갱신은 proxy.ts 가 이미 했으니 여기선 무시해도 된다.
        // 서버 액션 · route handler(로그인 · 로그아웃 · 콜백)에서는 그대로 써진다.
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // Server Component
        }
      },
    },
  });
}
