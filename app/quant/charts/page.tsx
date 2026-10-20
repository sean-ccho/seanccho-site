import type { Metadata } from "next";
import { NoData } from "@/components/NoData";
import { ScreenView } from "@/components/ScreenView";
import { getDashboard, goldenLists, latestCapture, marketRows } from "@/lib/dashboard";
import { getT } from "@/lib/lang";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.charts.metaTitle };
}

export default async function ChartsPage() {
  const data = await getDashboard();
  if (!data) return <NoData />;
  const info = new Map(data.charts.flatMap((m) => m.items.map((it) => [it.ticker, it.info] as const)));
  const rows = marketRows(data.charts, (ticker) => info.get(ticker) ?? null);
  return (
    <main className="container container--wide page">
      <ScreenView page="charts" rows={rows} golden={goldenLists(data, new Set(rows.map((r) => r.ticker)))}
        squeeze={data.squeeze} known={Object.keys(data.stocks ?? {})} captured={latestCapture(data)} />
    </main>
  );
}
