"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./LangProvider";

/** 퀀트 대시보드 메뉴 — 지금 페이지에 aria-current. */
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
    { href: "/quant/trades", label: t.nav.trades },
    // 비밀번호 페이지는 미리 읽지 않는다
    { href: "/quant/account", label: t.nav.account, noPrefetch: true },
    { href: "/quant/watchlist", label: t.nav.watchlist, noPrefetch: true },
  ];
  return (
    <nav aria-label={t.nav.dashMenu} className="q-nav site-nav">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}
          prefetch={"noPrefetch" in item ? false : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
