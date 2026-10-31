import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { getEtf } from "@/lib/etf";
import { fmtDate, pct, stockHref, tone, usd } from "@/lib/format";
import { industry, sector, type Dict } from "@/lib/i18n";
import { getT } from "@/lib/lang";
import { quadBoxes, quadEtfHref, quadListHref, REPS_TOP, sectorReps, type MapStock, type QuadBox } from "@/lib/sectorMap";
import { regionBasis } from "@/lib/stockStyle";
import type { StockRegion } from "@/lib/types";
import { getUniverseMarketServer } from "@/lib/universeServer";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.sectors.metaTitle };
}

function Quad({ box, t, lang }: { box: QuadBox; t: Dict; lang: "ko" | "en" }) {
  const S = t.sectors;
  // 3달 · 1년은 2026-10-31 밤 실행부터 — 그 전 데이터면 안 보인다
  const rets = ([[S.w1, box.med5], [S.m1, box.med20], [S.m3, box.med63], [S.y1, box.med252]] as const)
    .filter(([, v], i) => i < 2 || v != null);
  return (
    <article className={`quad quad--${box.quad.split("_")[0]}`} aria-labelledby={`quad-${box.quad}`}>
      <h3 id={`quad-${box.quad}`} className="quad__h">
        {t.style.quad[box.quad]} <span className="muted small">{t.style.quadEn[box.quad]}</span>
      </h3>
      <p className="small quad__stats">
        <span>{S.count(box.count)}</span>
        <span title={S.medianHelp}>
          {S.median}
          {rets.map(([label, v], i) => (
            // 기간과 숫자가 줄바꿈에 갈라지지 않게 한 덩어리로 (폰에서 '1년' / '+9.7%') — 줄은 덩어리 사이 빈칸에서만 바뀐다
            <Fragment key={label}>
              {" "}
              <span className="quad__ret">{i > 0 && "· "}{label} <b className={`num ${tone(v)}`}>{pct(v)}</b></span>
            </Fragment>
          ))}
        </span>
      </p>
      <p className="tiny muted quad__label">{S.industries}</p>
      <ul className="quad__chips">
        {box.industries.map(([name, n]) => (
          <li key={name} className="chip">{industry(lang, name)} <span className="tseg__count">{n}</span></li>
        ))}
      </ul>
      <p className="tiny muted quad__label">{S.leaders}</p>
      <ul className="quad__leaders">
        {box.leaders.map((s) => (
          <li key={s.ticker}>
            <Link className="tick" href={stockHref(s.ticker)} prefetch={false}>{s.ticker}</Link>{" "}
            <span className="muted quad__name">{s.company ?? ""}</span>{" "}
            <span className={`num small ${tone(s.ret20)}`}>{pct(s.ret20)}</span>
          </li>
        ))}
      </ul>
      <Link className="link-strong small quad__all" href={quadListHref(box.quad)} prefetch={false} title={S.allTitle}>
        {S.allStocks(box.count)}
      </Link>
      <p className="tiny muted quad__label">
        {S.etfs}
        {box.etfs.length > 0 && (
          <>
            {" · "}
            <Link className="link-strong" href={quadEtfHref(box.quad)} prefetch={false}>{S.etfTable}</Link>
          </>
        )}
      </p>
      {box.etfs.length ? (
        <ul className="quad__chips">
          {box.etfs.map((e) => (
            <li key={e.ticker}>
              <Link className="chip" href={`/quant/etf#etf-${e.ticker}`} prefetch={false}
                title={`${e.name ?? ""} — ${S.m1} ${pct(e.ret.m1)} · 3M ${pct(e.ret.m3)}`}>
                <span className="tick">{e.ticker}</span> <span className={`num ${tone(e.ret.m1)}`}>{pct(e.ret.m1)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tiny muted" style={{ margin: 0 }}>{S.noEtf}</p>
      )}
    </article>
  );
}

function RepsTable({ region, reps, t, lang }: {
  region: StockRegion; reps: [string, MapStock[]][]; t: Dict; lang: "ko" | "en";
}) {
  const S = t.sectors;
  const title = region === "global" ? S.repsGlobal : S.repsDomestic;
  return (
    <section className="card" aria-label={title}>
      <h2 className="reps__h">{title}</h2>
      <div className="table-wrap">
        <table className="data-table data-table--tight reps">
          <thead>
            <tr>
              <th scope="col">{S.colSector}</th>
              <th scope="col">{S.colCompany}</th>
              <th scope="col">{S.colExchange}</th>
              <th scope="col">{S.colTicker}</th>
              <th scope="col" className="r">{S.colPrice}</th>
              <th scope="col" className="r">{S.colUs}</th>
              <th scope="col" className="r">{S.colM1}</th>
            </tr>
          </thead>
          <tbody>
            {reps.map(([sec, rows]) =>
              rows.map((s, i) => {
                const st = s.info.style!;
                return (
                  <tr key={s.ticker} className={i === 0 ? "reps__first" : undefined}>
                    {i === 0 && (
                      <th scope="rowgroup" rowSpan={rows.length} className="reps__sector">
                        {sector(lang, sec)}
                        {S.sectorCycle[sec] && <span className="reps__cycle">{S.sectorCycle[sec]}</span>}
                      </th>
                    )}
                    <td className="reps__company" title={s.company ?? undefined}>{s.company ?? ""}</td>
                    <td className="small muted">{s.exchange}</td>
                    <td><Link className="tick" href={stockHref(s.ticker)} prefetch={false}>{s.ticker}</Link></td>
                    <td className="r num">{usd(s.price)}</td>
                    <td className="r num" title={regionBasis(t, st)}>
                      {st.us_share != null ? pct(st.us_share, 0, false) : <span className="muted">{S.estimated}</span>}
                    </td>
                    <td className={`r num ${tone(s.ret20)}`}>{pct(s.ret20)}</td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * 섹터 지도 — S&P 500 을 경기순환/방어 × 내수/글로벌 4칸으로 (사용자 시트 표 + 2026-10-30 주가 데이터 점검) + 섹터별 대표 기업
 * (글로벌 · 내수 매출 중심, 섹터 이름 아래 섹터 전체 성격).
 * 경기 성격은 세부 업종, 매출 지역은 SEC 10-K 미국 매출 비중 (Project_1 data.industry_style). 보기 전용.
 */
export default async function SectorsPage() {
  const [market, etf, { lang, t }] = await Promise.all([getUniverseMarketServer("sp500"), getEtf(), getT()]);
  const S = t.sectors;
  const items = market?.items ?? {};
  const hasStyle = Object.values(items).some((i) => i.style);
  const boxes = hasStyle ? quadBoxes(items, etf?.items ?? []) : [];
  return (
    <main className="container container--wide page">
      <div className="page-title">
        <h1>{S.title}</h1>
        <p>
          {S.sub}
          {market?.bar_date ? ` · ${S.asOf(fmtDate(market.bar_date, lang))}` : ""}
        </p>
      </div>
      {!market ? (
        <section className="card empty"><p style={{ margin: 0 }}>{S.noData}</p></section>
      ) : !hasStyle ? (
        <section className="card empty"><p style={{ margin: 0 }}>{S.noStyle}</p></section>
      ) : (
        <>
          <section className="card" aria-label={S.title}>
            <div className="quads__bands" aria-hidden="true">
              <span>{S.cyclicals}</span>
              <span>{S.defensives}</span>
            </div>
            <div className="quads">
              {boxes.map((b) => <Quad key={b.quad} box={b} t={t} lang={lang} />)}
            </div>
          </section>
          <div className="reps-grid">
            {(["global", "domestic"] as const).map((r) => (
              <RepsTable key={r} region={r} reps={sectorReps(items, r)} t={t} lang={lang} />
            ))}
          </div>
          <section className="card">
            <p className="tiny muted" style={{ margin: 0 }}>{S.repsNote(REPS_TOP)}</p>
            <p className="tiny muted" style={{ margin: "6px 0 0" }}>{S.method}</p>
            <p className="tiny muted" style={{ margin: "6px 0 0" }}>{S.honest}</p>
          </section>
        </>
      )}
    </main>
  );
}
