import Link from "next/link";
import type { FunnelCounts } from "@/lib/dashboard";
import type { Dict } from "@/lib/i18n";

/**
 * 매수 후보 아래 탭 (2026-10-31) — 매수 후보 · 점수 상위 · 1차 선별. 좁은 것 → 넓은 것, 숫자로 얼마나 추렸는지 보인다.
 * 예측 모델(2026-11-16, 내계좌에서 옮김) — 가치 분석가들의 종목 고르기라 매수 후보 묶음으로. 2026-11-17 부터 공개(비밀번호 없음).
 * 위 메뉴의 '매수 후보'는 이 주소들 어디에서든 켜진다 (QuantNav · BottomTabs).
 */
export const PICK_TABS = [
  { key: "candidates", href: "/quant/candidates", lock: false },
  { key: "charts", href: "/quant/charts", lock: false },
  { key: "all", href: "/quant/charts/all", lock: false },
  { key: "model", href: "/quant/model", lock: false },
] as const;

export type PickTab = (typeof PICK_TABS)[number]["key"];

const LABEL = { candidates: "candidates", charts: "charts", all: "allCharts", model: "model" } as const;

export function PickTabs({ current, t, counts }: { current: PickTab; t: Dict; counts?: FunnelCounts }) {
  const n: Partial<Record<PickTab, number | null>> = counts ?? {};
  return (
    <nav aria-label={t.nav.pickMenu} className="sub-tabs">
      {PICK_TABS.map((tab) => (
        // 관리자 페이지는 미리 읽지 않는다
        <Link key={tab.key} href={tab.href} aria-current={tab.key === current ? "page" : undefined}
          prefetch={tab.lock ? false : undefined}>
          {t.nav[LABEL[tab.key]]}
          {n[tab.key] != null && <span className="sub-tabs__n num">{n[tab.key]?.toLocaleString()}</span>}
          {tab.lock && (
            <svg className="sub-tabs__lock" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          )}
        </Link>
      ))}
    </nav>
  );
}
