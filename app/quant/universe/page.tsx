import type { Metadata } from "next";
import Link from "next/link";
import { ChartPrefsProvider } from "@/components/ChartPrefs";
import { UniverseScreen } from "@/components/UniverseScreen";
import { getDashboard } from "@/lib/dashboard";
import { stockHref } from "@/lib/format";
import { getT } from "@/lib/lang";
import { presetFromParams } from "@/lib/stockList";
import { isUniverseTab, UNIVERSE_TABS } from "@/lib/universe";
import { getUniverseMarket, getUniverseMarketServer } from "@/lib/universeServer";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.universe.metaTitle };
}

type Props = { searchParams: Promise<{ m?: string; t?: string; cycle?: string; region?: string; hl?: string; s?: string }> };

/**
 * 전체분석 = 필터 없이 시장 전체 (전체 = S&P 500 + 나스닥·NYSE + 번외 · S&P 500 · 그 밖의 나스닥·NYSE · 신규 상장 ·
 * 번외 = 두 시장 밖이지만 늘 보는 종목, 캐나다 상장도 — 2026-11-05).
 * 화면은 1차 선별과 같은 ScreenView.
 * 목록 데이터는 수 MB 라 브라우저가 GitHub raw 에서 직접 받고(UniverseScreen), 서버는 보유 종목·숏스퀴즈 상태만 넘긴다.
 * 캡처가 없어서 차트는 늘 TradingView 실시간.
 * ?t=티커 (다른 페이지의 티커 링크) — 그 종목이 든 탭(신규 상장 · 번외면 그 탭, 아니면 전체)을 열고 그 종목을 고른다.
 * ?cycle=&region=&s= (섹터 지도 4칸의 '전부 보기') — 그 필터·정렬을 건 채로 연다.
 * ?hl=high|low (오늘 탭 '시장 한눈에'의 52주 신고가 · 신저가 숫자) — 그 필터를 건 채로 (목록에 표시가 없는 예전 데이터면 무시).
 */
export default async function UniversePage({ searchParams }: Props) {
  const [data, { t }, sp, extra] = await Promise.all([getDashboard(), getT(), searchParams, getUniverseMarketServer("extra")]);
  const focus = typeof sp.t === "string" && /^[A-Z0-9.-]{1,12}$/i.test(sp.t) ? sp.t.toUpperCase() : null;
  const where = focus ? await getUniverseMarket(focus) : null;
  // 번외 탭은 번외 파일(extra.json)이 있을 때만 — Project_1 이 싣기 전에는 탭이 없고 화면은 예전과 같다
  const tabs = UNIVERSE_TABS.filter((k) => k !== "extra" || Object.keys(extra?.items ?? {}).length > 0);
  const asked = isUniverseTab(sp.m) && tabs.includes(sp.m) ? sp.m : null;
  const market = asked ?? (where === "new" || where === "extra" ? where : "all");
  const missing = focus && !where ? focus : null;
  const preset = presetFromParams(sp);
  const held = data ? Array.from(new Set(data.accounts.flatMap((a) => a.positions.map((p) => p.ticker)))) : [];
  return (
    <main className="container container--wide page">
      <nav className="sub-tabs sub-tabs--fit" aria-label={t.universe.tabsAria}>
        {tabs.map((k) => (
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
        <UniverseScreen key={`${market}:${sp.cycle ?? ""}:${sp.region ?? ""}:${sp.hl ?? ""}:${sp.s ?? ""}`} market={market} held={held}
          squeeze={data?.squeeze} focus={where ? focus : null} preset={preset} />
      </ChartPrefsProvider>
    </main>
  );
}
