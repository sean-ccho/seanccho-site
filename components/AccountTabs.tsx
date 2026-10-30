import Link from "next/link";
import { Fragment } from "react";
import type { Dict } from "@/lib/i18n";

/**
 * 내계좌 아래 탭 (2026-10-29) — 계좌 화면을 스크리너·차트·분석 메뉴와 떼어 한 묶음으로.
 * 앞 둘(내 계좌·관심종목)은 실제 돈이라 비밀번호(proxy.ts), 뒤 둘(PT-1·PT 거래로그)은 페이퍼 계좌라 공개.
 * 위 메뉴의 '내계좌'는 이 네 주소 어디에서든 켜진다 (QuantNav).
 */
export const ACCOUNT_TABS = [
  { key: "account", href: "/quant/account", lock: true },
  { key: "watchlist", href: "/quant/watchlist", lock: true },
  { key: "pt1", href: "/quant/pt1", lock: false },
  { key: "trades", href: "/quant/trades", lock: false },
] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number]["key"];

export function AccountTabs({ current, t }: { current: AccountTab; t: Dict }) {
  return (
    <nav aria-label={t.nav.acctMenu} className="acct-tabs">
      {ACCOUNT_TABS.map((tab, i) => (
        <Fragment key={tab.key}>
          {/* 실제 돈 | 페이퍼 사이 구분선 */}
          {i > 0 && tab.lock !== ACCOUNT_TABS[i - 1].lock && <span className="acct-tabs__sep" aria-hidden="true" />}
          {/* 비밀번호 페이지는 미리 읽지 않는다 */}
          <Link href={tab.href} aria-current={tab.key === current ? "page" : undefined} prefetch={tab.lock ? false : undefined}>
            {t.nav.acctTabs[tab.key]}
            {tab.lock && (
              <span className="acct-tabs__lock" aria-hidden="true">
                🔒
              </span>
            )}
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}
