import Link from "next/link";
import type { Dict } from "@/lib/i18n";

/**
 * '시장' 안쪽 탭 (2026-11-02) — ETF · 섹터 지도. 폰 아래 탭 막대의 '시장' 한 칸이 두 화면을 묶는다.
 * 넓은 화면은 위 메뉴에 둘이 따로 있어서 이 탭은 폰에서만 보인다 (globals.css .market-tabs).
 */
export const MARKET_TABS = [
  { key: "etf", href: "/quant/etf" },
  { key: "sectors", href: "/quant/sectors" },
] as const;

export function MarketTabs({ current, t }: { current: (typeof MARKET_TABS)[number]["key"]; t: Dict }) {
  return (
    <nav aria-label={t.nav.marketMenu} className="sub-tabs market-tabs">
      {MARKET_TABS.map((tab) => (
        <Link key={tab.key} href={tab.href} aria-current={tab.key === current ? "page" : undefined}>
          {t.nav[tab.key]}
        </Link>
      ))}
    </nav>
  );
}
