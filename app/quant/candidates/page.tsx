import type { Metadata } from "next";
import { NoData } from "@/components/NoData";
import { PickTabs } from "@/components/PickTabs";
import { ScreenView } from "@/components/ScreenView";
import { chartIndex, funnelCounts, getDashboard, goldenLists, latestCapture, type ScreenRow } from "@/lib/dashboard";
import { getT } from "@/lib/lang";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.cands.metaTitle };
}

export default async function CandidatesPage() {
  const [data, { t }] = await Promise.all([getDashboard(), getT()]);
  if (!data) return <NoData />;
  const images = chartIndex(data);
  // 후보는 30개쯤이라 재무를 다 넘긴다 (차트 페이지와 달리 줄이지 않음)
  const rows: ScreenRow[] = data.candidates.map((c) => ({
    ticker: c.ticker,
    held: c.held,
    market: c.market,
    info: c,
    images: images[c.ticker],
  }));
  return (
    <main className="container container--wide page">
      <PickTabs current="candidates" t={t} counts={funnelCounts(data)} />
      <ScreenView page="candidates" rows={rows} golden={goldenLists(data, new Set(rows.map((r) => r.ticker)))}
        squeeze={data.squeeze} captured={latestCapture(data)} />
    </main>
  );
}
