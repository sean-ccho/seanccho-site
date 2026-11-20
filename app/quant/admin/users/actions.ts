"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loginHref } from "@/lib/authPaths";
import { createSupabase } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

const PAGE = "/quant/admin/users";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 등급 바꾸기 (2026-11-20) — 관리자만. 여기서 한 번 확인하고, DB 정책(관리자만 role 수정)이 또 확인하고,
 * 마지막 관리자를 내리면 DB 트리거가 거절한다 (supabase/migrations/20261120_profiles_roles.sql).
 * 결과는 주소의 msg 로 화면 위에 보여 준다.
 */
export async function setRoleAction(form: FormData): Promise<void> {
  const me = await getViewer();
  if (!me || me.role !== "admin") redirect(loginHref(PAGE, { denied: !!me }));
  const id = String(form.get("id") ?? "");
  const role = String(form.get("role") ?? "");
  if (!UUID.test(id) || (role !== "admin" && role !== "user")) redirect(`${PAGE}?msg=bad`);
  const supabase = await createSupabase();
  if (!supabase) redirect(`${PAGE}?msg=fail`);
  const { data, error } = await supabase.from("profiles").update({ role }).eq("id", id).select("id");
  if (error) {
    const last = error.hint === "LAST_ADMIN" || /last admin/i.test(error.message);
    if (!last) console.error("[admin/users] setRole", error.message);
    redirect(`${PAGE}?msg=${last ? "last" : "fail"}`);
  }
  if (!data?.length) redirect(`${PAGE}?msg=none`);
  revalidatePath(PAGE);
  redirect(`${PAGE}?msg=${role === "admin" ? "up" : "down"}`);
}
