import type { Metadata } from "next";
import { NoData } from "@/components/NoData";
import { ScreenView } from "@/components/ScreenView";
import { getDashboard, goldenLists, latestCapture, marketRows } from "@/lib/dashboard";
import { getT } from "@/lib/lang";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.charts.allMeta };
}

/**
 * 전체차트 = 두 분석 시트의 모든 종목. 종목 정보는 stocks 맵에서.
 * all_charts 가 아직 없는 데이터(2026-10-17 밤 실행 전)면 차트추천 종목으로 대신 — 빈 화면 대신 같은 필터·정렬을 쓰게.
 */
export default async function AllChartsPage() {
  const [data, { t }] = await Promise.all([getDashboard(), getT()]);
  if (!data) return <NoData />;
  const fallback = !data.all_charts?.length;
  const markets = fallback ? data.charts : (data.all_charts ?? []);
  const chartInfo = new Map(data.charts.flatMap((m) => m.items.map((it) => [it.ticker, it.info] as const)));
  const rows = marketRows(markets, (ticker) => data.stocks?.[ticker] ?? chartInfo.get(ticker) ?? null);
  return (
    <main className="container container--wide page">
      <ScreenView page="all" rows={rows} golden={goldenLists(data, new Set(rows.map((r) => r.ticker)))}
        squeeze={data.squeeze} captured={latestCapture(data, markets)}
        notice={fallback ? t.charts.allFallback : null} pageSize={30} />
    </main>
  );
}
