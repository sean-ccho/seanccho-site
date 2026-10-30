"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCOUNT_TABS } from "./AccountTabs";
import { useT } from "./LangProvider";

const ACCOUNT_PATHS: readonly string[] = ACCOUNT_TABS.map((tab) => tab.href);

/** 퀀트 대시보드 메뉴 — 지금 페이지에 aria-current. 계좌 화면(내계좌·관심종목·PT-1·PT 거래로그)은 '내계좌' 하나로 묶고 그 안에서 탭. */
export function QuantNav() {
  const pathname = usePathname();
  const { t } = useT();
  const items = [
    { href: "/quant", label: t.nav.today },
    { href: "/quant/candidates", label: t.nav.candidates },
    { href: "/quant/charts", label: t.nav.charts },
    { href: "/quant/charts/all", label: t.nav.allCharts },
    { href: "/quant/universe", label: t.nav.universe },
    { href: "/quant/etf", label: t.nav.etf },
    { href: "/quant/sectors", label: t.nav.sectors },
  ];
  const inAccount = ACCOUNT_PATHS.includes(pathname);
  return (
    <nav aria-label={t.nav.dashMenu} className="q-nav site-nav">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
      {/* 비밀번호 페이지는 미리 읽지 않는다 */}
      <Link href="/quant/account" className="q-nav__acct" prefetch={false}
        aria-current={pathname === "/quant/account" ? "page" : inAccount ? "true" : undefined}>
        {t.nav.account}
      </Link>
    </nav>
  );
}
