import Link from "next/link";
import type { FunnelCounts } from "@/lib/dashboard";
import type { Dict } from "@/lib/i18n";

/**
 * 매수 후보 아래 탭 (2026-10-31) — 매수 후보 · 점수 상위 · 1차 선별. 좁은 것 → 넓은 것, 숫자로 얼마나 추렸는지 보인다.
 * 위 메뉴의 '매수 후보'는 이 세 주소 어디에서든 켜진다 (QuantNav).
 */
export const PICK_TABS = [
  { key: "candidates", href: "/quant/candidates" },
  { key: "charts", href: "/quant/charts" },
  { key: "all", href: "/quant/charts/all" },
] as const;

export type PickTab = (typeof PICK_TABS)[number]["key"];

const LABEL = { candidates: "candidates", charts: "charts", all: "allCharts" } as const;

export function PickTabs({ current, t, counts }: { current: PickTab; t: Dict; counts: FunnelCounts }) {
  return (
    <nav aria-label={t.nav.pickMenu} className="acct-tabs">
      {PICK_TABS.map((tab) => (
        <Link key={tab.key} href={tab.href} aria-current={tab.key === current ? "page" : undefined}>
          {t.nav[LABEL[tab.key]]}
          {counts[tab.key] != null && <span className="acct-tabs__n num">{counts[tab.key]?.toLocaleString()}</span>}
        </Link>
      ))}
    </nav>
  );
}
