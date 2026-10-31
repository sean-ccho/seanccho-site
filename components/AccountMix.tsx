import Link from "next/link";
import { QUAD_HEAVY, SECTOR_HEAVY, fillers, type AccountMix as Mix, type MixPart } from "@/lib/accountMix";
import type { EtfItem } from "@/lib/etf";
import { pct } from "@/lib/format";
import { sector, type Dict, type Lang } from "@/lib/i18n";
import type { Quad } from "@/lib/stockStyle";

function Bars({ parts, label }: { parts: MixPart[]; label: (k: string) => string }) {
  return (
    <ul className="mix-list">
      {parts.filter((p) => p.share >= 0.005).map((p) => (
        <li key={p.key} className={`mix-row${p.key === "other" ? " mix-row--other" : ""}`}>
          <span className="mix-row__label" title={label(p.key)}>{label(p.key)}</span>
          <span className="mix-row__bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, p.share * 100)}%` }} />
          </span>
          <span className="mix-row__pct num">{pct(p.share, 0, false)}</span>
        </li>
      ))}
    </ul>
  );
}

/** 내계좌 아래 — 보유 종목 + ETF 속 종목까지 풀어서 4칸 · 섹터 비중, 쏠림 한 줄, 비어 있는 칸을 채우는 ETF. 보기 전용. */
export function AccountMix({ mix, etfs, t, lang }: { mix: Mix; etfs: EtfItem[]; t: Dict; lang: Lang }) {
  const A = t.accountMix;
  const quadName = (k: string) => (k === "other" ? A.other : t.style.quad[k as Quad]);
  const sectorName = (k: string) => (k === "other" ? A.otherSector : sector(lang, k));
  const heavyQuad = mix.quads.find((p) => p.key !== "other" && p.share >= QUAD_HEAVY);
  const heavySector = mix.sectors.find((p) => p.key !== "other" && p.share >= SECTOR_HEAVY);
  const fill = fillers(mix, etfs);
  return (
    <section className="card" aria-labelledby="acct-mix-title">
      <div className="section-head">
        <h2 id="acct-mix-title">{A.title}</h2>
        <p>{A.sub(mix.etfCount)}</p>
      </div>
      <div className="mix-grid">
        <div>
          <h3 className="mix-grid__h">{A.quadsTitle}</h3>
          <Bars parts={mix.quads} label={quadName} />
        </div>
        <div>
          <h3 className="mix-grid__h">{A.sectorsTitle}</h3>
          <Bars parts={mix.sectors} label={sectorName} />
        </div>
      </div>
      <ul className="mix-notes small">
        {heavyQuad ? (
          <li><span className="badge badge--warn">{A.heavy}</span> {A.heavyQuad(quadName(heavyQuad.key), pct(heavyQuad.share, 0, false))}</li>
        ) : (
          <li className="muted">{A.balanced}</li>
        )}
        {heavySector && (
          <li><span className="badge badge--warn">{A.heavy}</span> {A.heavySector(sectorName(heavySector.key), pct(heavySector.share, 0, false))}</li>
        )}
      </ul>
      {fill.length > 0 && (
        <>
          <p className="tiny muted mix-fill__h">{A.fillTitle}</p>
          <ul className="mix-fill">
            {fill.map((f) => (
              <li key={f.quad} className="small">
                <b>{t.style.quad[f.quad]}</b>{" "}
                {f.etfs.length ? f.etfs.map(({ etf: e, share }) => (
                  <Link key={e.ticker} className="chip" href={`/quant/etf#etf-${e.ticker}`} prefetch={false}
                    title={`${e.name ?? e.ticker} — ${t.style.quad[f.quad]} ${pct(share, 0, false)}`}>
                    <span className="tick">{e.ticker}</span> <span className="muted">{pct(share, 0, false)}</span>
                  </Link>
                )) : <span className="muted">{A.noFill}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="tiny muted" style={{ margin: "10px 0 0" }}>
        {mix.cadSkipped ? A.cadSkipped : mix.usdcad ? A.fx(mix.usdcad.toFixed(4)) : ""} {A.note}
      </p>
    </section>
  );
}
