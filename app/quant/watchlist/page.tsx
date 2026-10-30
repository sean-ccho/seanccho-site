import type { Metadata } from "next";
import { AccountTabs } from "@/components/AccountTabs";
import { WatchlistView } from "@/components/WatchlistView";
import { getDashboard } from "@/lib/dashboard";
import { getT } from "@/lib/lang";
import { sheetsConfigured, spreadsheetUrl } from "@/lib/sheets";
import { siteStocks } from "@/lib/siteStocks";
import { readWatchlist } from "@/lib/watchlist";

// 시트에서 고친 값이 새로고침하면 바로 보이도록 매번 시트를 읽는다 (캐시 없음)
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.watch.metaTitle };
}

export default async function WatchlistPage() {
  const { t } = await getT();
  const head = (
    <>
      <AccountTabs current="watchlist" t={t} />
      <div className="page-title">
        <h1>{t.watch.title}</h1>
        <p>{t.watch.sub}</p>
      </div>
    </>
  );

  if (!sheetsConfigured()) {
    return (
      <main className="container container--wide page">
        {head}
        <section className="card empty">
          <h2 style={{ fontSize: 18 }}>{t.account.notConfigured}</h2>
          <p style={{ margin: "8px 0 0" }}>{t.account.notConfiguredBody}</p>
        </section>
      </main>
    );
  }

  let rows;
  try {
    rows = await readWatchlist();
  } catch (err) {
    console.error("[watchlist] read", err);
    return (
      <main className="container container--wide page">
        {head}
        <section className="card empty">
          <h2 style={{ fontSize: 18 }}>{t.account.loadFailed}</h2>
          <p className="small muted" style={{ margin: "8px 0 0" }}>{err instanceof Error ? err.message : String(err)}</p>
        </section>
      </main>
    );
  }

  const data = await getDashboard();
  // 줄마다 종목 정보 — 시트 현재가가 비면 이 가격을 쓰고, '+ 매수' 팝업에 신호·ATR 을 넘긴다
  const infos = await siteStocks(data, rows.map((r) => r.input.ticker));

  return (
    <main className="container container--wide page">
      {head}
      <WatchlistView rows={rows} infos={infos} sheetUrl={spreadsheetUrl()} />
    </main>
  );
}
