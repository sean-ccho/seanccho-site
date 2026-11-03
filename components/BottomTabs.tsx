"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCOUNT_TABS } from "./AccountTabs";
import { Icon, type IconName } from "./Icon";
import { useT } from "./LangProvider";
import { MARKET_TABS } from "./MarketTabs";
import { PICK_TABS } from "./PickTabs";

type Tab = { key: "today" | "candidates" | "universe" | "market" | "account"; href: string; icon: IconName; group?: readonly string[] };

const TABS: Tab[] = [
  { key: "today", href: "/quant", icon: "home" },
  { key: "candidates", href: "/quant/candidates", icon: "star", group: PICK_TABS.map((x) => x.href) },
  { key: "universe", href: "/quant/universe", icon: "grid" },
  { key: "market", href: "/quant/etf", icon: "bars", group: MARKET_TABS.map((x) => x.href) },
  { key: "account", href: "/quant/account", icon: "wallet", group: ACCOUNT_TABS.map((x) => x.href) },
];

/**
 * 폰 아래 탭 막대 (760px 이하, 2026-11-02) — 위에서 옆으로 밀리던 메뉴 6개 대신 엄지가 닿는 5칸.
 * '시장' = ETF · 섹터 지도, 묶음 탭은 안쪽 탭 어디에서든 켜진다 (QuantNav 와 같은 규칙). 넓은 화면은 위 메뉴 그대로.
 */
export function BottomTabs() {
  const pathname = usePathname();
  const { t } = useT();
  const current = (tab: Tab) => (pathname === tab.href ? "page" : tab.group?.includes(pathname) ? "true" : undefined);
  return (
    <nav className="bottom-tabs" aria-label={t.nav.dashMenu}>
      {TABS.map((tab) => (
        // 비밀번호 페이지는 미리 읽지 않는다 (QuantNav 와 같게)
        <Link key={tab.key} href={tab.href} aria-current={current(tab)} prefetch={tab.key === "account" ? false : undefined}>
          <Icon name={tab.icon} size={22} />
          <span>{t.nav.tab[tab.key]}</span>
        </Link>
      ))}
    </nav>
  );
}
