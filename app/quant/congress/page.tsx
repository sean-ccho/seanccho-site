import type { Metadata } from "next";
import Link from "next/link";
import { CongressExplorer } from "@/components/CongressExplorer";
import { AMOUNTS, compactCongress, PERIODS } from "@/lib/congress";
import { fmtDate } from "@/lib/format";
import { getT } from "@/lib/lang";
import { UNIVERSE_TABS } from "@/lib/universe";
import { getCongressFeed, getCongressTickers, getUniverseMarketServer, hasUniverseFile } from "@/lib/universeServer";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.congress.metaTitle };
}

type Props = { searchParams: Promise<{ q?: string; v?: string; d?: string; min?: string }> };

/** ?d= · ?min= — 버튼에 있는 값만 받고 나머지는 기본(1년 · 전체). */
function pick(raw: string | undefined, allowed: readonly number[], fallback: number): number {
  const n = Number(raw);
  return typeof raw === "string" && allowed.includes(n) ? n : fallback;
}

/**
 * 국회의원 거래 신고 (2026-11-06) — 하원 PTR 지난 1년 전부 · 의원별 (Project_1 data/congress_trades.py →
 * universe-data congress_tickers.json). 전체분석 탭 줄의 마지막 탭으로 둔다 (같은 종목 목록을 보는 다른 렌즈라서).
 * ?q=의원 이름 또는 티커 (오늘 탭 · 종목 카드의 의원 이름 링크), ?v=members 의원별 보기로 연다.
 * ?d=30 · ?min=15001 — 기간 · 금액 하한 (오늘 탭 '같은 조건 전부 보기', 2026-11-12).
 * 표시 전용 — 신고는 최대 45일 늦고 금액은 구간. 5 U.S.C. §13107 — 상업 목적 사용 금지라 무료 화면에만.
 */
export default async function CongressPage({ searchParams }: Props) {
  const [{ lang, t }, sp, file, feed, extra, hasCa] = await Promise.all([
    getT(), searchParams, getCongressTickers(), getCongressFeed(), getUniverseMarketServer("extra"), hasUniverseFile("ca"),
  ]);
  const C = t.congress;
  // 전체분석과 같은 탭 줄 — 번외 · 캐나다는 그 파일이 있을 때만
  const tabs = UNIVERSE_TABS.filter((k) => (k === "extra" ? Object.keys(extra?.items ?? {}).length > 0 : k === "ca" ? hasCa : true));
  const data = file ? compactCongress(file) : null;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const view = sp.v === "members" ? "members" : "trades";
  return (
    <main className="container container--wide page">
      <nav className="sub-tabs sub-tabs--fit" aria-label={t.universe.tabsAria}>
        {tabs.map((k) => (
          <Link key={k} href={`/quant/universe?m=${k}`}>{t.universe.tab[k]}</Link>
        ))}
        <Link href="/quant/congress" aria-current="page">{C.tab}</Link>
      </nav>
      <div className="page-title">
        <h1>{C.pageTitle}</h1>
        {data && file && (
          <p>{C.pageSub(fmtDate(file.as_of, lang), data.rows.length, feed?.counts?.filings ?? 0)}</p>
        )}
      </div>
      {data && file ? (
        <CongressExplorer members={data.members} rows={data.rows} asOf={file.as_of} initialQ={q} initialView={view}
          initialDays={pick(sp.d, PERIODS, 365)} initialMin={pick(sp.min, AMOUNTS, 0)} />
      ) : (
        <p className="card muted">{C.noData}</p>
      )}
      <p className="tiny muted" style={{ margin: 0 }}>
        {C.note}{" "}
        <a href="https://disclosures-clerk.house.gov/FinancialDisclosure" target="_blank" rel="noopener noreferrer">{C.official} ↗</a>
      </p>
    </main>
  );
}
