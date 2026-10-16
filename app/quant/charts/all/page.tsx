import type { Metadata } from "next";
import { ChartsView } from "@/components/ChartsView";
import { NoData } from "@/components/NoData";
import { getDashboard } from "@/lib/dashboard";
import { fmtDateTime } from "@/lib/format";
import { getT } from "@/lib/lang";
import type { ChartMarket, Dashboard, Fundamentals } from "@/lib/types";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.charts.allMeta };
}

/** 전체차트 = 두 분석 시트의 모든 종목. 종목 정보는 stocks 맵에서 (재무는 정렬에 쓰는 것만 남겨 보내는 양을 줄인다). */
function allMarkets(data: Dashboard): ChartMarket[] {
  return (data.all_charts ?? []).map((m) => ({
    key: m.key,
    label: m.label,
    captured_at: m.captured_at,
    items: m.items.map((it) => {
      const info = data.stocks?.[it.ticker] ?? null;
      const f = info?.fundamentals;
      const slim = info && f ? { ...info, fundamentals: { revenue_growth: f.revenue_growth, market_cap: f.market_cap } as Fundamentals } : info;
      return { ticker: it.ticker, held: it.held, info: slim, images: it.images };
    }),
  }));
}

export default async function AllChartsPage() {
  const [data, { lang, t }] = await Promise.all([getDashboard(), getT()]);
  if (!data) return <NoData />;
  const markets = allMarkets(data);
  const captured = markets.map((m) => m.captured_at).filter((x): x is string => Boolean(x)).sort().at(-1);
  return (
    <main className="container page">
      <div className="page-title" id="top" style={{ scrollMarginTop: 16 }}>
        <h1>{t.charts.allTitle}</h1>
        <p>
          {t.charts.allSub}
          {captured ? t.charts.captured(fmtDateTime(captured, lang)) : ""}
        </p>
      </div>
      <ChartsView markets={markets} golden={[]} known={Object.keys(data.stocks ?? {})} pageSize={30} />
    </main>
  );
}
