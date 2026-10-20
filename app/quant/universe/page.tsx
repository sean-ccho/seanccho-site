import type { Metadata } from "next";
import Link from "next/link";
import { ChartPrefsProvider } from "@/components/ChartPrefs";
import { UniverseScreen } from "@/components/UniverseScreen";
import { getDashboard } from "@/lib/dashboard";
import { getT } from "@/lib/lang";
import { isUniverseKey, UNIVERSE_KEYS } from "@/lib/universe";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.universe.metaTitle };
}

type Props = { searchParams: Promise<{ m?: string }> };

/**
 * 전체분석 = 필터 없이 시장 전체 (S&P 500 · 그 밖의 나스닥·NYSE · 신규 상장). 화면은 전체차트와 같은 ScreenView.
 * 목록 데이터는 수 MB 라 브라우저가 GitHub raw 에서 직접 받고(UniverseScreen), 서버는 보유 종목·숏스퀴즈 상태만 넘긴다.
 * 캡처가 없어서 차트는 늘 TradingView 실시간.
 */
export default async function UniversePage({ searchParams }: Props) {
  const [data, { t }, sp] = await Promise.all([getDashboard(), getT(), searchParams]);
  const market = isUniverseKey(sp.m) ? sp.m : "sp500";
  const held = data ? Array.from(new Set(data.accounts.flatMap((a) => a.positions.map((p) => p.ticker)))) : [];
  return (
    <main className="container container--wide page">
      <nav className="tseg universe-tabs" aria-label={t.universe.tabsAria}>
        {UNIVERSE_KEYS.map((k) => (
          <Link key={k} href={`/quant/universe?m=${k}`} aria-current={k === market ? "page" : undefined}>
            {t.universe.tab[k]}
          </Link>
        ))}
      </nav>
      <ChartPrefsProvider forceLive>
        <UniverseScreen key={market} market={market} held={held} squeeze={data?.squeeze} known={Object.keys(data?.stocks ?? {})} />
      </ChartPrefsProvider>
    </main>
  );
}
