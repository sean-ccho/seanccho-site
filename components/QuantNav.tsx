"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
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
  const ref = useRef<HTMLElement>(null);

  // 폰: 메뉴가 옆으로 밀리는 한 줄이라, 지금 탭을 가운데로 + 가려진 쪽 끝을 흐리게 (data-more-left/right → globals.css)
  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const cur = nav.querySelector<HTMLElement>("a[aria-current]");
    if (cur && nav.scrollWidth > nav.clientWidth) {
      const off = cur.getBoundingClientRect().left - nav.getBoundingClientRect().left;
      nav.scrollLeft += off - (nav.clientWidth - cur.offsetWidth) / 2;
    }
    const edges = () => {
      nav.dataset.moreLeft = String(nav.scrollLeft > 2);
      nav.dataset.moreRight = String(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2);
    };
    edges();
    nav.addEventListener("scroll", edges, { passive: true });
    window.addEventListener("resize", edges);
    return () => {
      nav.removeEventListener("scroll", edges);
      window.removeEventListener("resize", edges);
    };
  }, [pathname]);

  return (
    <nav ref={ref} aria-label={t.nav.dashMenu} className="q-nav site-nav">
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
