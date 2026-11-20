import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { loginHref } from "./authPaths";
import { hasAuthCookie, supabaseEnv } from "./supabase/env";
import { createSupabase } from "./supabase/server";

/**
 * 지금 보는 사람 (2026-11-20) — 구글 로그인(Supabase) + 등급(profiles.role). Next 16 가이드의 DAL:
 * 진짜 확인은 데이터 바로 옆(페이지 · 서버 액션)에서 — proxy.ts 는 로그인 화면으로 먼저 보내 주는 1차 거름망일 뿐이다.
 * 등급은 매번 DB 에서 읽는다 (JWT 에 넣지 않음) → 관리 › 회원 탭에서 바꾸면 바로 반영.
 * DB 를 못 읽으면(프로젝트 멈춤 등) 'user' 로 본다 — 실제 돈 화면은 확실할 때만 연다.
 */

export type Role = "user" | "admin";

export type Viewer = {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: Role;
};

/** 화면(클라이언트)에 넘기는 부분 — id 는 안 넘긴다. */
export type ViewerInfo = Omit<Viewer, "id">;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** 로그인 기능이 켜져 있나 (Vercel 에 Supabase 환경변수가 있나). */
export function loginEnabled(): boolean {
  return supabaseEnv() !== null;
}

/** 한 요청 안에서는 한 번만 확인한다 (root layout · quant layout · 페이지가 같이 불러도). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!hasAuthCookie((await cookies()).getAll())) return null;
  const supabase = await createSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const id = str(claims?.sub);
  if (error || !claims || !id) return null;
  const { data: row } = await supabase
    .from("profiles")
    .select("email, full_name, avatar_url, role")
    .eq("id", id)
    .maybeSingle<{ email: string | null; full_name: string | null; avatar_url: string | null; role: string | null }>();
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const email = str(row?.email) ?? str(claims.email) ?? "";
  return {
    id,
    email,
    name: str(row?.full_name) ?? str(meta.full_name) ?? str(meta.name) ?? (email.split("@")[0] || "?"),
    avatar: str(row?.avatar_url) ?? str(meta.avatar_url) ?? str(meta.picture),
    role: row?.role === "admin" ? "admin" : "user",
  };
});

export async function isAdmin(): Promise<boolean> {
  return (await getViewer())?.role === "admin";
}

/**
 * 관리자 화면 맨 위에서 부른다. 로그인 안 함 → 로그인 화면 (끝나면 next 로 돌아옴),
 * 로그인했지만 관리자 아님 → 로그인 화면의 '관리자만' 안내.
 */
export async function requireAdmin(next: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(loginHref(next));
  if (viewer.role !== "admin") redirect(loginHref(next, { denied: true }));
  return viewer;
}

export function viewerInfo(viewer: Viewer | null): ViewerInfo | null {
  if (!viewer) return null;
  const { id: _id, ...info } = viewer;
  return info;
}
