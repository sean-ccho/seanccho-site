"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";
import { LOGIN_PATH } from "@/lib/authPaths";
import type { ViewerInfo } from "@/lib/viewer";
import { useT } from "./LangProvider";

/** 구글 사진 (없거나 못 받으면 이름 첫 글자). 구글 사진 주소는 referrer 가 붙으면 가끔 막혀서 뺀다. */
function Avatar({ viewer, size }: { viewer: ViewerInfo; size: number }) {
  const [broken, setBroken] = useState(false);
  if (viewer.avatar && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="user-avatar" src={viewer.avatar} alt="" width={size} height={size} referrerPolicy="no-referrer"
        onError={() => setBroken(true)} />
    );
  }
  return (
    <span className="user-avatar user-avatar--letter" style={{ width: size, height: size }} aria-hidden="true">
      {(viewer.name || viewer.email || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * 머리 오른쪽 계정 자리 (2026-11-20, 구글 로그인). 로그인 전 '로그인' → /quant/login (끝나면 지금 화면으로),
 * 로그인 후 사진 동그라미 → 이름 · 이메일 · 등급 · (관리자) 내 계좌 · 관리 · 로그아웃.
 * 메뉴는 브라우저 popover (바깥을 누르거나 Esc 로 닫힘). 정보는 서버(app/quant/layout.tsx)가 확인해서 넘긴다.
 * enabled=false (Vercel 에 Supabase 환경변수 없음) 면 아무것도 안 그린다.
 */
export function UserMenu({ viewer, enabled }: { viewer: ViewerInfo | null; enabled: boolean }) {
  const { t } = useT();
  const pathname = usePathname() || "/quant";
  const pop = useRef<HTMLDivElement>(null);
  if (!enabled) return null;
  if (!viewer) {
    if (pathname === LOGIN_PATH) return null;
    return (
      <Link className="user-login" href={`${LOGIN_PATH}?next=${encodeURIComponent(pathname)}`} prefetch={false}>
        {t.auth.login}
      </Link>
    );
  }
  const admin = viewer.role === "admin";
  const close = () => pop.current?.hidePopover();
  return (
    <div className="user-menu">
      <button type="button" className="user-btn" popoverTarget="user-pop" aria-label={`${t.auth.menu} · ${viewer.name}`}
        title={viewer.email}>
        <Avatar viewer={viewer} size={30} />
      </button>
      <div id="user-pop" ref={pop} popover="auto" className="user-pop">
        <div className="user-pop__who">
          <Avatar viewer={viewer} size={40} />
          <div className="user-pop__id">
            <b>{viewer.name}</b>
            <span className="user-pop__email">{viewer.email}</span>
            <span className={`badge user-role user-role--${viewer.role}`}>{admin ? t.auth.roleAdmin : t.auth.roleUser}</span>
          </div>
        </div>
        {admin && (
          <nav className="user-pop__links" aria-label={t.auth.menu}>
            <Link href="/quant/account" prefetch={false} onClick={close}>{t.auth.toAccount}</Link>
            <Link href="/quant/admin" prefetch={false} onClick={close}>{t.auth.toAdmin}</Link>
          </nav>
        )}
        <form action={signOut} className="user-pop__out">
          <input type="hidden" name="next" value={pathname} />
          <button type="submit" className="btn btn--small">{t.auth.logout}</button>
        </form>
      </div>
    </div>
  );
}
