import type { Metadata } from "next";
import { MarketTabs } from "@/components/MarketTabs";
import { SectorMap } from "@/components/SectorMap";
import { getEtf } from "@/lib/etf";
import { fmtDate } from "@/lib/format";
import { getT } from "@/lib/lang";
import { sectorMapData } from "@/lib/sectorMap";
import { getUniverseMarketServer } from "@/lib/universeServer";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.sectors.metaTitle };
}

/**
 * 섹터 지도 — S&P 500 을 경기순환/방어 × 내수/글로벌 4칸으로 (사용자 시트 표 + 2026-10-30 주가 데이터 점검) + 섹터별 대표 기업
 * (글로벌 · 내수 매출 중심을 섹터마다 나란히). 경기 성격은 세부 업종, 매출 지역은 SEC 10-K 미국 매출 비중
 * (Project_1 data.industry_style). 보기 전용. 기간 · 섹터 고르기는 components/SectorMap (2026-11-10 개편).
 */
export default async function SectorsPage() {
  const [market, etf, { lang, t }] = await Promise.all([getUniverseMarketServer("sp500"), getEtf(), getT()]);
  const S = t.sectors;
  const items = market?.items ?? {};
  const hasStyle = Object.values(items).some((i) => i.style);
  const asOf = market?.bar_date ? fmtDate(market.bar_date, lang) : null;
  return (
    <main className="container container--wide page">
      <MarketTabs current="sectors" t={t} />
      {market && hasStyle ? (
        <>
          <SectorMap data={sectorMapData(items, etf?.items ?? [])} asOf={asOf} />
          <section className="card">
            <p className="tiny muted" style={{ margin: 0 }}>{S.method}</p>
            <p className="tiny muted" style={{ margin: "6px 0 0" }}>{S.honest}</p>
          </section>
        </>
      ) : (
        <>
          <div className="page-title">
            <h1>{S.title}</h1>
            <p>
              {S.sub}
              {asOf ? ` · ${S.asOf(asOf)}` : ""}
            </p>
          </div>
          <section className="card empty"><p style={{ margin: 0 }}>{market ? S.noStyle : S.noData}</p></section>
        </>
      )}
    </main>
  );
}
