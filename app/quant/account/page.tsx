import type { Metadata } from "next";
import { AccountView } from "@/components/AccountView";
import type { StockHint } from "@/components/RiskPanel";
import { readAccount } from "@/lib/account";
import { withLiveClose } from "@/lib/bench";
import { getDashboard } from "@/lib/dashboard";
import { todayToronto } from "@/lib/format";
import { getT } from "@/lib/lang";
import { sheetsConfigured, spreadsheetUrl } from "@/lib/sheets";
import { siteStocks } from "@/lib/siteStocks";
import type { SqzInfo } from "@/lib/types";

// 시트에서 고친 값이 새로고침하면 바로 보이도록 매번 시트를 읽는다 (캐시 없음)
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.account.metaTitle };
}

export default async function AccountPage() {
  const { t } = await getT();
  const head = (
    <div className="page-title">
      <h1>{t.account.title}</h1>
      <p>{t.account.sub}</p>
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
  let spyLive: number | null = null;
  try {
    ({ rows, spyLive } = await readAccount());
  } catch (err) {
    console.error("[account] read", err);
    return (
      <main className="container container--wide page">
        {head}
        <section className="card empty">
          <h2 style={{ fontSize: 18 }}>{t.account.loadFailed}</h2>
          <p className="small muted" style={{ margin: "8px 0 0" }}>
            {err instanceof Error ? err.message : String(err)}
          </p>
        </section>
      </main>
    );
  }

  const data = await getDashboard();
  const today = todayToronto();
  // 장중엔 시트 'SPY 실시간'을 오늘 종가처럼 붙여서, 실시간가로 계산한 수익률과 같은 시점의 SPY 와 비교한다
  const bench = withLiveClose(data?.benchmark ?? null, spyLive, today);
  // 보유 중인데 시트 현재가가 아직 없는 줄(웹에서 막 넣은 거래) → 사이트의 마지막 종가로 평가액·손익·리스크를 낸다
  // (샘플 줄은 합계에 안 들어가니 채우지 않는다)
  const site = await siteStocks(data, rows.filter((r) => !r.closed && !r.sample).map((r) => r.input.ticker));
  rows = rows.map((r) => {
    const p = site[r.input.ticker.toUpperCase()]?.price;
    return r.closed || r.sample || r.price != null || p == null ? r : { ...r, price: p, priceSite: true };
  });
  // 보유 종목 SQZ 모멘텀 일·주·월 (표시 전용) — 사이트가 이미 가진 종목 정보에서 꺼낸다 (보유 목록을 밖으로 내보내지 않는다)
  const sqz: Record<string, SqzInfo> = Object.fromEntries(
    Object.entries(site).flatMap(([tk, s]) => (s.sqzmom ? [[tk, s.sqzmom] as const] : [])),
  );
  // 계산기·리스크 패널용 — 대시보드에 있는 종목(후보·보유·차트)의 섹터·실적일·ATR·가격
  const hints: Record<string, StockHint> = Object.fromEntries(
    Object.entries({ ...site, ...data?.stocks }).map(([tk, s]) => [tk, {
      sector: s.sector, earnings: s.earnings_date, atr: s.atr_pct ?? null, price: s.price, move: s.earnings_move ?? null,
    }]),
  );

  return (
    <main className="container container--wide page">
      {head}
      <AccountView rows={rows} sheetUrl={spreadsheetUrl()} bench={bench}
        hints={hints} sqz={sqz} today={today} />
    </main>
  );
}
