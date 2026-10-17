import type { Metadata } from "next";
import { ChartsView } from "@/components/ChartsView";
import { NoData } from "@/components/NoData";
import { getDashboard } from "@/lib/dashboard";
import { fmtDateTime } from "@/lib/format";
import { getT } from "@/lib/lang";
import type { ChartMarket, Dashboard, Fundamentals, TickerInfo } from "@/lib/types";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.charts.allMeta };
}

/** 재무는 정렬에 쓰는 매출 성장·시총만 남긴다 (브라우저로 보내는 양 줄이기). */
function slimInfo(info: TickerInfo | null): TickerInfo | null {
  const f = info?.fundamentals;
  return info && f ? { ...info, fundamentals: { revenue_growth: f.revenue_growth, market_cap: f.market_cap } as Fundamentals } : info;
}

/**
 * 전체차트 = 두 분석 시트의 모든 종목. 종목 정보는 stocks 맵에서.
 * all_charts 가 아직 없는 데이터(2026-10-17 밤 실행 전)면 차트추천 종목으로 대신 — 빈 화면 대신 같은 필터·정렬을 쓰게.
 */
function allMarkets(data: Dashboard): { markets: ChartMarket[]; fallback: boolean } {
  if (!data.all_charts?.length) {
    return {
      fallback: true,
      markets: data.charts.map((m) => ({ ...m, items: m.items.map((it) => ({ ...it, info: slimInfo(it.info) })) })),
    };
  }
  return { fallback: false, markets: allChartMarkets(data) };
}

function allChartMarkets(data: Dashboard): ChartMarket[] {
  return (data.all_charts ?? []).map((m) => ({
    key: m.key,
    label: m.label,
    captured_at: m.captured_at,
    items: m.items.map((it) => ({ ticker: it.ticker, held: it.held, info: slimInfo(data.stocks?.[it.ticker] ?? null), images: it.images })),
  }));
}

export default async function AllChartsPage() {
  const [data, { lang, t }] = await Promise.all([getDashboard(), getT()]);
  if (!data) return <NoData />;
  const { markets, fallback } = allMarkets(data);
  const captured = markets.map((m) => m.captured_at).filter((x): x is string => Boolean(x)).sort().at(-1);
  return (
    <main className="container page">
      <div className="page-title" id="top" style={{ scrollMarginTop: 16 }}>
        <h1>{t.charts.allTitle}</h1>
        <p>
          {t.charts.allSub}
          {captured ? t.charts.captured(fmtDateTime(captured, lang)) : ""}
        </p>
        {fallback && <p className="small" style={{ margin: "6px 0 0", color: "var(--warn)" }}>{t.charts.allFallback}</p>}
      </div>
      <ChartsView markets={markets} golden={[]} known={Object.keys(data.stocks ?? {})} pageSize={30} />
    </main>
  );
}
