import type { Metadata } from "next";
import { ChartsView, type GoldenList } from "@/components/ChartsView";
import { NoData } from "@/components/NoData";
import { getDashboard, latestCapture, stockInfo } from "@/lib/dashboard";
import { fmtDateTime } from "@/lib/format";
import { getT } from "@/lib/lang";
import type { ChartMarket, Dashboard, Fundamentals } from "@/lib/types";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.charts.metaTitle };
}

/** 차트 페이지는 재무 중 매출 성장·시총만 쓴다 (정렬용) — 브라우저로 보내는 양을 줄인다. */
function slim(markets: ChartMarket[]): ChartMarket[] {
  return markets.map((m) => ({
    ...m,
    items: m.items.map((it) => {
      if (!it.info?.fundamentals) return it;
      const f = it.info.fundamentals;
      const keep = { revenue_growth: f.revenue_growth, market_cap: f.market_cap } as Fundamentals;
      return { ...it, info: { ...it.info, fundamentals: keep } };
    }),
  }));
}

/** PT 골든크로스 목록 + 종목 이름·점수·거래량 + 차트가 있는지. */
function goldenLists(data: Dashboard): GoldenList[] {
  const charted = new Set(data.charts.flatMap((m) => m.items.map((it) => it.ticker)));
  return Object.entries(data.golden_cross ?? {}).map(([market, items]) => ({
    market,
    items: items.map((g) => {
      const info = stockInfo(data, g.ticker);
      return {
        ticker: g.ticker,
        company: info?.company ?? null,
        timeframes: g.timeframes,
        score: info?.score ?? null,
        vol_ratio: info?.vol_ratio ?? null,
        charted: charted.has(g.ticker),
      };
    }),
  }));
}

export default async function ChartsPage() {
  const [data, { lang, t }] = await Promise.all([getDashboard(), getT()]);
  if (!data) return <NoData />;
  const captured = latestCapture(data);

  return (
    <main className="container page">
      <div className="page-title" id="top" style={{ scrollMarginTop: 16 }}>
        <h1>{t.charts.title}</h1>
        <p>
          {t.charts.sub}
          {captured ? t.charts.captured(fmtDateTime(captured, lang)) : ""}
        </p>
      </div>
      <ChartsView markets={slim(data.charts)} golden={goldenLists(data)} squeeze={data.squeeze}
        known={Object.keys(data.stocks ?? {})} />
    </main>
  );
}
