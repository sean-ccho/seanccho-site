import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { loginHref, requestOrigin, safeNext } from "@/lib/authPaths";
import { noStoreFetch, supabaseEnv } from "@/lib/supabase/env";
import { createSupabase } from "@/lib/supabase/server";

/**
 * 구글 로그인에서 돌아오는 곳 (2026-11-20) — Supabase 가 붙여 준 code 를 세션(로그인 쿠키)으로 바꾸고 next 로 보낸다.
 * sb_flow_id = supabase-js 가 로그인 시작 때 붙인 흐름 번호 (탭 여러 개로 동시에 로그인해도 맞는 확인값을 쓰게).
 * 실패(구글에서 취소 · 코드 만료 · 확인값 쿠키 없음)하면 로그인 화면에 '다시 시도' 안내.
 * next 는 이 사이트 안 경로만 (lib/authPaths.ts safeNext — '//다른사이트' 같은 열린 리다이렉트 막기).
 * 관리자로 들어오면 이 브라우저에 sc_owner=1 (사이트 주인 표시) — 방문자 집계에서만 쓴다 (VisitTracker · /api/visit).
 * 권한과는 상관없다: 관리자 확인은 늘 lib/viewer.ts 가 DB 등급으로.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));
  const code = params.get("code");
  const flowId = params.get("sb_flow_id");
  const supabase = await createSupabase();
  let ok = false;
  let owner = false;
  if (code && supabase) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) console.error("[auth] exchangeCodeForSession", error.message);
    else {
      ok = true;
      owner = await isAdminToken(data.session?.access_token, data.user?.id);
    }
  } else if (params.get("error")) {
    console.error("[auth] provider error", params.get("error"), params.get("error_description"));
  }
  const to = new URL(ok ? next : loginHref(next, { error: "callback" }), requestOrigin(request.headers) ?? request.url);
  const res = NextResponse.redirect(to);
  // 로그인 쿠키가 실린 응답 — 어디에도 캐시되면 안 된다
  res.headers.set("cache-control", "private, no-cache, no-store, must-revalidate, max-age=0");
  if (owner) res.cookies.set("sc_owner", "1", { maxAge: 400 * 86_400, path: "/", sameSite: "lax", secure: process.env.VERCEL === "1" });
  // 로그인 시작 때 supabase-js 가 남긴 확인값 쿠키(…-code-verifier) — 흐름 번호를 주소에 안 붙이는 기본 설정에선 고정 이름 하나만
  // 지우고 나머지(흐름별 칸 · 목록)는 400일 남는다. 로그인이 끝났으니 다 지운다 (supabase-js 도 로그아웃 때 이렇게 다 지운다).
  // 지우기는 res.cookies 가 아니라 cookies() 로 — Next 16.4 가 둘을 합칠 때 res 쪽 '값 없음 + Max-Age=0' 을 다시 읽다가
  // Max-Age 를 잃어 지워지지 않고 빈 값으로 남는다 (2026-11-20 확인).
  if (ok) {
    const jar = await cookies();
    for (const c of jar.getAll()) {
      if (c.name.startsWith("sb-") && c.name.endsWith("-code-verifier")) jar.set(c.name, "", { maxAge: 0, path: "/" });
    }
  }
  return res;
}

/** 방금 받은 토큰으로 내 등급을 읽는다 (쿠키에 막 쓴 세션을 같은 요청 안에서 다시 읽지 않으려고 토큰을 직접 붙임). */
async function isAdminToken(token: string | undefined, id: string | undefined): Promise<boolean> {
  const env = supabaseEnv();
  if (!env || !token || !id) return false;
  const db = createClient(env.url, env.key, {
    global: { fetch: noStoreFetch, headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await db.from("profiles").select("role").eq("id", id).maybeSingle<{ role: string }>();
  return data?.role === "admin";
}
