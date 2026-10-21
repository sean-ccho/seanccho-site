import type { Metadata } from "next";
import Link from "next/link";
import { ChartPrefsProvider } from "@/components/ChartPrefs";
import { UniverseScreen } from "@/components/UniverseScreen";
import { getDashboard } from "@/lib/dashboard";
import { stockHref } from "@/lib/format";
import { getT } from "@/lib/lang";
import { isUniverseTab, UNIVERSE_TABS } from "@/lib/universe";
import { getUniverseMarket } from "@/lib/universeServer";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.universe.metaTitle };
}

type Props = { searchParams: Promise<{ m?: string; t?: string }> };

/**
 * 전체분석 = 필터 없이 시장 전체 (전체 = S&P 500 + 나스닥·NYSE · S&P 500 · 그 밖의 나스닥·NYSE · 신규 상장).
 * 화면은 전체차트와 같은 ScreenView.
 * 목록 데이터는 수 MB 라 브라우저가 GitHub raw 에서 직접 받고(UniverseScreen), 서버는 보유 종목·숏스퀴즈 상태만 넘긴다.
 * 캡처가 없어서 차트는 늘 TradingView 실시간.
 * ?t=티커 (다른 페이지의 티커 링크) — 그 종목이 든 탭(신규 상장이면 신규 상장, 아니면 전체)을 열고 그 종목을 고른다.
 */
export default async function UniversePage({ searchParams }: Props) {
  const [data, { t }, sp] = await Promise.all([getDashboard(), getT(), searchParams]);
  const focus = typeof sp.t === "string" && /^[A-Z0-9.-]{1,12}$/i.test(sp.t) ? sp.t.toUpperCase() : null;
  const where = focus ? await getUniverseMarket(focus) : null;
  const market = isUniverseTab(sp.m) ? sp.m : where === "new" ? "new" : "all";
  const missing = focus && !where ? focus : null;
  const held = data ? Array.from(new Set(data.accounts.flatMap((a) => a.positions.map((p) => p.ticker)))) : [];
  return (
    <main className="container container--wide page">
      <nav className="tseg universe-tabs" aria-label={t.universe.tabsAria}>
        {UNIVERSE_TABS.map((k) => (
          <Link key={k} href={`/quant/universe?m=${k}`} aria-current={k === market ? "page" : undefined}>
            {t.universe.tab[k]}
          </Link>
        ))}
      </nav>
      {missing && (
        <p className="card small" role="status">
          {t.universe.notListed(missing)}{" "}
          {data?.stocks?.[missing] && <Link className="link-strong" href={stockHref(missing)}>{t.universe.detail}</Link>}
        </p>
      )}
      <ChartPrefsProvider forceLive>
        <UniverseScreen key={market} market={market} held={held} squeeze={data?.squeeze}
          focus={where ? focus : null} />
      </ChartPrefsProvider>
    </main>
  );
}
