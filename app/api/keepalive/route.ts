import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { noStoreFetch, supabaseEnv } from "@/lib/supabase/env";

/**
 * Supabase 깨우기 (2026-11-20) — 무료 프로젝트는 1주일 동안 DB 활동이 없으면 멈추고, 멈추면 구글 로그인이 안 된다.
 * 방문자는 Supabase 를 안 건드리고 로그인은 가끔이라, Vercel 크론(vercel.json, 하루 한 번)이 여기를 불러 DB 를 한 번 깨운다.
 * DB 함수 public.ping() = 'select 1' (supabase/migrations). 로그인 정보 없이 공개 키로만 부른다.
 * CRON_SECRET 을 Vercel 에 넣으면 Vercel 크론만 부를 수 있다 (Authorization: Bearer <CRON_SECRET> 를 Vercel 이 붙인다).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret && !sameText(given, secret)) return Response.json({ ok: false }, { status: 401 });
  const env = supabaseEnv();
  if (!env) return Response.json({ ok: false, reason: "supabase env not set" });
  const supabase = createClient(env.url, env.key, {
    global: { fetch: noStoreFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("ping");
  if (error) {
    console.error("[keepalive]", error.message);
    return Response.json({ ok: false, reason: error.message }, { status: 502 });
  }
  return Response.json({ ok: data === 1, at: new Date().toISOString() });
}

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
