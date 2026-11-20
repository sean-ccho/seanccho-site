import type { Metadata } from "next";
import { AdminTabs, LockIcon } from "@/components/AdminTabs";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { ago, makeClock, ms, when } from "@/lib/adminTime";
import { createSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/viewer";
import { setRoleAction } from "./actions";

/**
 * 관리 · 회원 (2026-11-20) — 구글로 로그인한 사람과 등급(관리자 / 회원). 관리자 = 내계좌 · 관심종목 · 관리.
 * 목록 · 수정 모두 로그인한 관리자 본인의 세션으로 (Supabase 비밀 키 안 씀) — DB 정책이 관리자인지 다시 확인한다.
 * 본인만 보는 화면이라 한국어만 · 시간은 토론토.
 */

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "관리 · 회원", robots: { index: false, follow: false } };

type Row = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
};

const MSG: Record<string, { ok: boolean; text: string }> = {
  up: { ok: true, text: "관리자로 올렸어요." },
  down: { ok: true, text: "회원으로 내렸어요." },
  last: { ok: false, text: "마지막 관리자는 내릴 수 없어요 — 다른 사람을 먼저 관리자로 올려 주세요." },
  none: { ok: false, text: "바뀐 줄이 없어요 (이미 지워진 계정이거나 권한이 없어요)." },
  fail: { ok: false, text: "바꾸지 못했어요 (Supabase 오류 — 잠시 뒤 다시 해 주세요)." },
  bad: { ok: false, text: "잘못된 요청이에요." },
};

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin("/quant/admin/users");
  const sp = await searchParams;
  const msgKey = Array.isArray(sp.msg) ? sp.msg[0] : sp.msg;
  const msg = msgKey ? MSG[msgKey] : undefined;
  const now = Date.now();
  const clock = makeClock(now);
  const supabase = await createSupabase();
  const res = supabase
    ? await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, role, created_at, last_sign_in_at")
        .order("role", { ascending: true })
        .order("created_at", { ascending: true })
        .overrideTypes<Row[], { merge: false }>()
    : null;
  const rows = res?.data ?? [];
  const admins = rows.filter((r) => r.role === "admin").length;

  return (
    <main className="container container--wide page adm">
      <AdminTabs current="users" />
      <div className="page-title adm-title">
        <div>
          <h1>관리 · 회원</h1>
          <p>구글로 로그인한 사람 · 관리자 {admins}명 · 회원 {rows.length - admins}명. 관리자는 내 계좌 · 관심종목 · 관리를 봐요 · 시간은 토론토(ET)</p>
        </div>
        <span className="adm-lock"><LockIcon />관리자만 · 구글 로그인</span>
      </div>

      {msg && <p className={`form-msg ${msg.ok ? "form-msg--good" : "form-msg--bad"}`} role="status">{msg.text}</p>}

      {!res || res.error ? (
        <section className="card adm-card">
          <h2>회원 목록을 읽지 못했어요</h2>
          <p className="small muted">{res?.error?.message ?? "Supabase 연결 정보가 없어요"} — Supabase 에 supabase/migrations 의 SQL 을 실행했는지 확인해 주세요.</p>
        </section>
      ) : (
        <section className="card adm-card">
          <div className="table-wrap">
            <table className="data-table adm-tbl adm-users">
              <thead>
                <tr>
                  <th scope="col">사람</th>
                  <th scope="col">등급</th>
                  <th scope="col">가입</th>
                  <th scope="col">마지막 로그인</th>
                  <th scope="col"><span className="sr-only">등급 바꾸기</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isMe = r.id === me.id;
                  const admin = r.role === "admin";
                  const who = r.email || r.full_name || r.id.slice(0, 8);
                  const confirm = admin
                    ? isMe
                      ? "나 자신을 회원으로 내릴까요? 내리면 이 화면과 내 계좌를 더는 못 봐요."
                      : `${who} 을(를) 회원으로 내릴까요? 내 계좌 · 관심종목 · 관리를 더는 못 봐요.`
                    : `${who} 을(를) 관리자로 올릴까요? 내 계좌(실제 돈) · 관심종목 · 관리를 모두 보게 돼요.`;
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className="adm-user">
                          {r.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img className="user-avatar" src={r.avatar_url} alt="" width={28} height={28} referrerPolicy="no-referrer" />
                          ) : (
                            <span className="user-avatar user-avatar--letter" style={{ width: 28, height: 28 }} aria-hidden="true">
                              {who.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="adm-user__id">
                            <b>{r.full_name || "—"}{isMe && <span className="muted"> (나)</span>}</b>
                            <span className="small muted">{r.email}</span>
                          </span>
                        </span>
                      </td>
                      <td><span className={`badge user-role user-role--${admin ? "admin" : "user"}`}>{admin ? "관리자" : "회원"}</span></td>
                      <td className="num" title={r.created_at}>{when(ms(r.created_at), clock)}</td>
                      <td className="num" title={r.last_sign_in_at ?? ""}>
                        {r.last_sign_in_at ? `${when(ms(r.last_sign_in_at), clock)} · ${ago(ms(r.last_sign_in_at), now)}` : "—"}
                      </td>
                      <td className="r">
                        <form action={setRoleAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="role" value={admin ? "user" : "admin"} />
                          <ConfirmSubmit className="btn btn--small" confirm={confirm}>{admin ? "회원으로" : "관리자로"}</ConfirmSubmit>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ margin: "10px 0 0" }}>
            새로 구글 로그인한 사람은 자동으로 회원이에요. 마지막 관리자는 내릴 수 없어요 (DB 가 막아요). 계정을 지우려면 Supabase → Authentication → Users.
          </p>
        </section>
      )}
    </main>
  );
}
