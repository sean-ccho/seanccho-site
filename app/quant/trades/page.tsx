import type { Metadata } from "next";
import { AccountTabs } from "@/components/AccountTabs";
import { NoData } from "@/components/NoData";
import { TradeLogView } from "@/components/TradeLogView";
import { getDashboard } from "@/lib/dashboard";
import { getT } from "@/lib/lang";
import { requireAdmin } from "@/lib/viewer";

// 관리자만 (2026-11-24) — 로그인 쿠키를 보므로 매번 그린다 (다른 사람에게 캐시된 화면이 가지 않게)
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.trades.metaTitle };
}

export default async function TradesPage() {
  await requireAdmin("/quant/trades");
  const [data, { t }] = await Promise.all([getDashboard(), getT()]);
  if (!data) return <NoData />;
  return (
    <main className="container container--wide page">
      <AccountTabs current="trades" t={t} />
      <div className="page-title">
        <h1>{t.trades.title}</h1>
        <p>{t.trades.sub}</p>
      </div>
      <TradeLogView accounts={data.accounts} />
    </main>
  );
}
