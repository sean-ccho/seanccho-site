import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithGoogle, signOut } from "@/app/auth/actions";
import { isAdminPath, LOGIN_PATH, safeNext } from "@/lib/authPaths";
import { getT } from "@/lib/lang";
import { getViewer, loginEnabled } from "@/lib/viewer";

/**
 * 로그인 (2026-11-20, 구글 · Supabase). 관리자 화면(내계좌 · 관심종목 · 관리)을 로그인 없이 열면 proxy.ts 가 여기로,
 * 회원(user)이 열면 lib/viewer.ts requireAdmin 이 denied=1 로 보낸다. 끝나면 next 로 돌아간다.
 * - 관리자가 이미 로그인돼 있으면 바로 next 로
 * - error: off(환경변수 없음) · start(로그인 시작 실패) · callback(구글에서 취소 · 코드 만료 등)
 */

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.auth.metaTitle, robots: { index: false, follow: false } };
}

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const [{ t }, sp, viewer] = await Promise.all([getT(), searchParams, getViewer()]);
  const A = t.auth;
  const next = safeNext(one(sp.next));
  const errorKind = one(sp.error);
  const enabled = loginEnabled();
  // 관리자 화면으로 가려던 회원 (주소에 denied 가 없어도 next 가 관리자 화면이면 같은 안내)
  const denied = !!viewer && viewer.role !== "admin" && (one(sp.denied) === "1" || isAdminPath(next));
  if (viewer?.role === "admin" && !errorKind && next !== LOGIN_PATH) redirect(next);

  const googleButton = (label: string) => (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <button type="submit" className="btn login-google">
        <GoogleMark />
        {label}
      </button>
    </form>
  );

  return (
    <main className="container page login-page">
      <section className="card login-card" aria-labelledby="login-title">
        <h1 id="login-title">{denied ? A.deniedTitle : A.title}</h1>
        {!enabled ? (
          <p className="form-msg form-msg--bad" role="alert">{A.errOff}</p>
        ) : viewer ? (
          <>
            <p>{denied ? A.deniedBody(viewer.email || viewer.name) : A.already(viewer.email || viewer.name)}</p>
            {!denied && viewer.role !== "admin" && <p className="small muted">{A.memberNote}</p>}
            {errorKind && errorKind !== "off" && <p className="form-msg form-msg--bad" role="alert">{A.errFailed}</p>}
            <div className="login-actions">
              {googleButton(A.other)}
              <form action={signOut}>
                <input type="hidden" name="next" value="/quant" />
                <button type="submit" className="btn">{A.logout}</button>
              </form>
            </div>
          </>
        ) : (
          <>
            <p>{A.lead}</p>
            {errorKind && <p className="form-msg form-msg--bad" role="alert">{errorKind === "off" ? A.errOff : A.errFailed}</p>}
            <div className="login-actions">{googleButton(A.google)}</div>
          </>
        )}
        <p className="small login-back">
          <Link href="/quant">{A.back} →</Link>
        </p>
      </section>
    </main>
  );
}
