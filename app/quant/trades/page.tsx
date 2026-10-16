import type { Metadata } from "next";
import { NoData } from "@/components/NoData";
import { TradeLogView } from "@/components/TradeLogView";
import { getDashboard } from "@/lib/dashboard";
import { getT } from "@/lib/lang";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.trades.metaTitle };
}

export default async function TradesPage() {
  const [data, { t }] = await Promise.all([getDashboard(), getT()]);
  if (!data) return <NoData />;
  return (
    <main className="container page">
      <div className="page-title">
        <h1>{t.trades.title}</h1>
        <p>{t.trades.sub}</p>
      </div>
      <TradeLogView accounts={data.accounts} />
    </main>
  );
}
