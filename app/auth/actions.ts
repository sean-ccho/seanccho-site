"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminPath, loginHref, requestOrigin, safeNext } from "@/lib/authPaths";
import { createSupabase } from "@/lib/supabase/server";

/**
 * 구글 로그인 시작 (2026-11-20) — Supabase 가 구글 계정 고르는 화면 주소를 만들어 주고(PKCE 확인값은 쿠키에),
 * 거기로 보낸다. 구글 → Supabase → /auth/callback (app/auth/callback/route.ts) → next.
 * 돌아올 주소는 지금 연 주소(운영 · 미리보기 · 내 Mac)로 — Supabase 허용 목록에 없는 주소면 Supabase 가 거절한다.
 * prompt=select_account: 구글에 로그인된 계정이 하나여도 고르는 화면을 보여 준다 (다른 계정으로 바꿔 들어오기).
 */
export async function signInWithGoogle(form: FormData): Promise<void> {
  const next = safeNext(form.get("next"));
  const supabase = await createSupabase();
  if (!supabase) redirect(loginHref(next, { error: "off" }));
  const origin = requestOrigin(await headers());
  if (!origin) redirect(loginHref(next, { error: "start" }));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data?.url) {
    console.error("[auth] signInWithOAuth", error?.message);
    redirect(loginHref(next, { error: "start" }));
  }
  redirect(data.url);
}

/** 로그아웃 — 이 브라우저만 (다른 기기의 로그인은 그대로). 관리자 화면에서 나가면 오늘 화면으로. */
export async function signOut(form: FormData): Promise<void> {
  const next = safeNext(form.get("next"));
  const supabase = await createSupabase();
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) console.error("[auth] signOut", error.message);
  }
  redirect(isAdminPath(next) ? "/quant" : next);
}
