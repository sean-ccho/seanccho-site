import type { Metadata } from "next";
import { NoData } from "@/components/NoData";
import { PickTabs } from "@/components/PickTabs";
import { ScreenView } from "@/components/ScreenView";
import { funnelCounts, getDashboard, goldenLists, latestCapture, marketRows } from "@/lib/dashboard";
import { getT } from "@/lib/lang";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.charts.metaTitle };
}

export default async function ChartsPage() {
  const [data, { t }] = await Promise.all([getDashboard(), getT()]);
  if (!data) return <NoData />;
  const info = new Map(data.charts.flatMap((m) => m.items.map((it) => [it.ticker, it.info] as const)));
  const rows = marketRows(data.charts, (ticker) => info.get(ticker) ?? null);
  return (
    <main className="container container--wide page">
      <PickTabs current="charts" t={t} counts={funnelCounts(data)} />
      <ScreenView page="charts" rows={rows} golden={goldenLists(data, new Set(rows.map((r) => r.ticker)))}
        squeeze={data.squeeze} captured={latestCapture(data)} />
    </main>
  );
}
