"use client";

import { useRef, useState } from "react";
import { ChartShot } from "./ChartShot";
import { useT } from "./LangProvider";
import { TickerLink } from "./TickerLink";
import { SellBar, nextChangeText } from "./SellBar";
import { fmtDate, fmtDateTime, pct, pp, tone, tvUrl, usd } from "@/lib/format";
import { sector, term } from "@/lib/i18n";
import type { ChartImages, Position, Timeframe } from "@/lib/types";

const VIEW_TFS: Timeframe[] = ["1H", "4H", "Daily", "Weekly", "Monthly"];

type Props = {
  positions: Position[];
  images: Record<string, ChartImages>;
  capturedAt: string | null;
};

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19 L4 5" />
      <path d="M4 19 L20 19" />
      <path d="M8 15 L12 10 L15 13 L20 7" />
    </svg>
  );
}

/** 보유 종목 표(넓은 화면)·카드(좁은 화면) + 고른 종목의 차트. */
export function HoldingsPanel({ positions, images, capturedAt }: Props) {
  const { lang, t } = useT();
  const [sel, setSel] = useState(positions[0]?.ticker ?? "");
  const [tf, setTf] = useState<Timeframe>("Daily");
  const viewerRef = useRef<HTMLElement>(null);

  const pick = (ticker: string) => {
    setSel(ticker);
    viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (positions.length === 0) {
    return (
      <section className="card" aria-labelledby="holdings-title">
        <div className="section-head">
          <h2 id="holdings-title">{t.holdings.title}</h2>
        </div>
        <p className="muted" style={{ margin: "12px 0 0" }}>
          {t.holdings.empty}
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="card" id="holdings" aria-labelledby="holdings-title">
        <div className="section-head">
          <h2 id="holdings-title">{t.holdings.title}</h2>
          <p>{t.holdings.sub}</p>
        </div>

        <div className="table-wrap holdings-table">
          <table className="data-table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th scope="col">{t.common.ticker}</th>
                <th scope="col">{t.holdings.colBought}</th>
                <th scope="col">{t.holdings.colPrice}</th>
                <th scope="col" className="r">
                  {t.common.ret}
                </th>
                <th scope="col" style={{ paddingLeft: 24 }}>
                  {t.holdings.colBar}
                </th>
                <th scope="col">{t.holdings.colNext}</th>
                <th scope="col" className="r">
                  {t.holdings.colChart}
                </th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.ticker} data-selected={p.ticker === sel}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <TickerLink ticker={p.ticker} style={{ fontSize: 16 }} />
                      {p.strategy && <span className="chip">{term(lang, p.strategy)}</span>}
                    </div>
                    <div className="cell-sub">{[p.company, sector(lang, p.sector)].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>
                    <div className="num">{usd(p.entry_price)}</div>
                    <div className="cell-sub">
                      {fmtDate(p.entry_date, lang)} · {t.holdings.dayN(p.days_held)}
                    </div>
                  </td>
                  <td>
                    <div className="num" style={{ fontWeight: 600 }}>
                      {usd(p.price)}
                    </div>
                    <div className="cell-sub">{t.holdings.high(usd(p.highest_price))}</div>
                  </td>
                  <td className="r">
                    <div className={`num ${tone(p.return)}`} style={{ fontWeight: 600, fontSize: 16 }}>
                      {pct(p.return)}
                    </div>
                    <div className="cell-sub">
                      {t.common.vsSpy} {pp(p.return, p.spy_return)}
                    </div>
                  </td>
                  <td style={{ paddingLeft: 24 }}>
                    <SellBar pos={p} />
                  </td>
                  <td className="small" style={{ color: "var(--ink-2)" }}>
                    {nextChangeText(p, t, lang)}
                    {p.defer_count > 0 && <div className="badge badge--warn">{t.holdings.deferred(p.defer_count)}</div>}
                  </td>
                  <td className="r">
                    <button type="button" className="btn" aria-pressed={p.ticker === sel}
                      aria-label={t.holdings.viewChartAria(p.ticker)} onClick={() => pick(p.ticker)}
                      style={p.ticker === sel ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}>
                      <ChartIcon />
                      {t.holdings.view}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="holding-cards">
          {positions.map((p) => (
            <article key={p.ticker} className="holding-card" data-selected={p.ticker === sel}>
              <div className="holding-card__head">
                <TickerLink ticker={p.ticker} style={{ fontSize: 17 }} />
                {p.strategy && <span className="chip">{term(lang, p.strategy)}</span>}
                <span className={`holding-card__ret ${tone(p.return)}`}>{pct(p.return)}</span>
              </div>
              <div className="cell-sub" style={{ marginTop: 2 }}>
                {t.holdings.cardLine(usd(p.entry_price), p.days_held, usd(p.price), pp(p.return, p.spy_return))}
              </div>
              <SellBar pos={p} />
              <div className="cell-sub" style={{ marginTop: 6 }}>
                {nextChangeText(p, t, lang)}
              </div>
              <button type="button" className="btn" style={{ width: "100%", marginTop: 10 }}
                onClick={() => pick(p.ticker)} aria-label={t.holdings.viewChartAria(p.ticker)}>
                <ChartIcon />
                {t.holdings.viewChart}
              </button>
            </article>
          ))}
        </div>

        <div className="legend-row">
          <span className="legend-key">
            <span className="legend-key__dot" aria-hidden="true" />
            {t.holdings.legendNow}
          </span>
          <span className="legend-key">
            <span className="legend-key__tick" aria-hidden="true" />
            {t.holdings.legendEntry}
          </span>
          <span>{t.holdings.legendNote}</span>
        </div>
      </section>

      <section className="card viewer" ref={viewerRef} aria-labelledby="viewer-title" style={{ scrollMarginTop: 16 }}>
        <div className="viewer-head">
          <div>
            <h2 id="viewer-title" style={{ fontSize: 19 }}>
              {t.holdings.viewerTitle} · <span className="tick">{sel}</span>
            </h2>
            <p className="section-sub" style={{ fontSize: 13 }}>
              {t.holdings.viewerSub}
            </p>
          </div>
          <div className="viewer-controls">
            <div className="seg seg--mono" role="group" aria-label={t.common.ticker}>
              {positions.map((p) => (
                <button key={p.ticker} type="button" aria-pressed={p.ticker === sel} onClick={() => setSel(p.ticker)}>
                  {p.ticker}
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label={t.common.tfGroup}>
              {VIEW_TFS.map((k) => (
                <button key={k} type="button" aria-pressed={k === tf} onClick={() => setTf(k)}>
                  {t.common.tf[k]}
                </button>
              ))}
            </div>
            <a className="link-strong" href={tvUrl(sel)} target="_blank" rel="noopener noreferrer">
              TradingView ↗
            </a>
          </div>
        </div>
        <figure>
          <ChartShot src={images[sel]?.[tf]} alt={t.common.chartAlt(sel, t.common.tf[tf])} />
          <figcaption>{capturedAt ? t.holdings.captured(fmtDateTime(capturedAt, lang)) : t.holdings.noCaptured}</figcaption>
        </figure>
      </section>
    </>
  );
}
