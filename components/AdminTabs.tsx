import Link from "next/link";

/**
 * 관리 아래 탭 (2026-11-05) — 파이프라인 · 방문자. 둘 다 비밀번호 화면(proxy.ts)이라 미리 읽지 않는다.
 * 본인만 보는 화면이라 한국어만 (내계좌 탭과 같은 .sub-tabs 모양).
 */
export const ADMIN_TABS = [
  { key: "pipeline", href: "/quant/admin", label: "파이프라인" },
  { key: "visitors", href: "/quant/admin/visitors", label: "방문자" },
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number]["key"];

export function AdminTabs({ current }: { current: AdminTab }) {
  return (
    <nav aria-label="관리 메뉴" className="sub-tabs adm-tabs">
      {ADMIN_TABS.map((tab) => (
        <Link key={tab.key} href={tab.href} prefetch={false} aria-current={tab.key === current ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** 자물쇠 아이콘 (관리 화면 제목 옆 '관리자만'). */
export const LockIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
