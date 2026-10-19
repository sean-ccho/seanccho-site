import type { Metadata } from "next";
import { WatchlistView } from "@/components/WatchlistView";
import { getDashboard } from "@/lib/dashboard";
import { getT } from "@/lib/lang";
import { sheetsConfigured, spreadsheetUrl } from "@/lib/sheets";
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
    <div className="page-title">
      <h1>{t.watch.title}</h1>
      <p>{t.watch.sub}</p>
    </div>
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
  const prices = Object.fromEntries(
    Object.entries(data?.stocks ?? {}).filter(([, s]) => s.price != null).map(([tk, s]) => [tk, s.price as number]),
  );

  return (
    <main className="container container--wide page">
      {head}
      <WatchlistView rows={rows} known={Object.keys(data?.stocks ?? {})} prices={prices} sheetUrl={spreadsheetUrl()} />
    </main>
  );
}
