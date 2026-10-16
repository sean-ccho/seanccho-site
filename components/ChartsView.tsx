"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChartGrid } from "./ChartGrid";
import { useT } from "./LangProvider";
import { SqueezePanel } from "./SqueezePanel";
import { StockChips } from "./StockChips";
import { StockControls, useStockList } from "./StockControls";
import { num, pct, stockHref, tvUrl, usd } from "@/lib/format";
import { term } from "@/lib/i18n";
import type { ListRow } from "@/lib/stockList";
import type { ChartImages, ChartMarket, Dashboard, GoldenTf } from "@/lib/types";

export type GoldenRow = {
  ticker: string;
  company: string | null;
  timeframes: GoldenTf[];
  score: number | null;
  vol_ratio: number | null;
  charted: boolean;
};
export type GoldenList = { market: string; items: GoldenRow[] };

function anchorId(ticker: string): string {
  return `c-${ticker.replace(/[^A-Za-z0-9]/g, "-")}`;
}

/** PT 골든크로스 목록 (시장별) — 차트가 없는 종목도 다 나온다. */
function GoldenPanel({ lists, onShowChart }: { lists: GoldenList[]; onShowChart: (ticker: string) => void }) {
  const { lang, t } = useT();
  const L = t.list;
  const total = lists.reduce((s, l) => s + l.items.length, 0);
  if (total === 0) return null;
  const marketLabel = (k: string) => (k === "sp500" ? "S&P 500" : term(lang, "나스닥·NYSE"));
  return (
    <details className="card golden-panel">
      <summary>
        <span className="up" style={{ fontWeight: 700 }}>▲ {L.goldenTitle}</span>
        {lists.map((l) => (
          <span key={l.market} className="chip">
            {marketLabel(l.market)} <span className="num" style={{ fontWeight: 600 }}>{l.items.length}</span>
          </span>
        ))}
      </summary>
      <p className="small muted" style={{ margin: "10px 0 0" }}>{L.goldenSub}</p>
      {lists.filter((l) => l.items.length > 0).map((l) => (
        <div key={l.market} style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 15 }}>
            {marketLabel(l.market)} · {L.goldenCount(l.items.length)}
          </h3>
          <div className="table-wrap">
            <table className="data-table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th scope="col">{t.common.ticker}</th>
                  <th scope="col">{t.common.tf.Daily}</th>
                  <th scope="col">{t.common.tf.Weekly}</th>
                  <th scope="col">{t.common.tf.Monthly}</th>
                  <th scope="col" className="r">{L.colScore}</th>
                  <th scope="col" className="r" title={L.volHelp}>{L.colVol}</th>
                  <th scope="col" className="r">{t.holdings.colChart}</th>
                </tr>
              </thead>
              <tbody>
                {l.items.map((g) => (
                  <tr key={g.ticker}>
                    <td>
                      <Link className="tick" href={stockHref(g.ticker)}>{g.ticker}</Link>
                      <div className="cell-sub">{g.company}</div>
                    </td>
                    {(["daily", "weekly", "monthly"] as const).map((tf) => {
                      const x = g.timeframes.find((y) => y.tf === tf);
                      if (!x) return <td key={tf} className="muted">—</td>;
                      const soon = x.gap != null && x.gap < 0;
                      return (
                        <td key={tf} className="small">
                          <span className={`badge ${soon ? "badge--mid" : "badge--good"}`}>
                            ▲ {soon ? L.crossGoldenSoon : L.crossGolden}
                          </span>{" "}
                          <span className="num">{pct(x.gap)}</span>
                        </td>
                      );
                    })}
                    <td className="r num">★ {g.score?.toFixed(1) ?? "—"}</td>
                    <td className="r num">{g.vol_ratio != null ? `${num(g.vol_ratio, 1)}×` : "—"}</td>
                    <td className="r">
                      {g.charted ? (
                        <button type="button" className="btn btn--small" onClick={() => onShowChart(g.ticker)}>
                          {L.toChart}
                        </button>
                      ) : (
                        <span className="small muted">{L.noCapture}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </details>
  );
}

/** 구글 시트 '차트분석' 탭처럼 종목별 차트를 아래로 쭉 — 후보 페이지와 같은 필터·정렬. */
export function ChartsView({ markets, golden, squeeze, known, pageSize }: {
  markets: ChartMarket[];
  golden: GoldenList[];
  squeeze?: Dashboard["squeeze"];
  known: string[];
  /** 있으면 처음엔 이만큼만 그리고 '더 보기'로 늘린다 (전체차트 — 종목이 수백 개). */
  pageSize?: number;
}) {
  const { lang, t } = useT();
  const { rows, images } = useMemo(() => {
    const out: ListRow[] = [];
    const imgs: Record<string, ChartImages> = {};
    for (const m of markets) {
      for (const it of m.items) {
        if (imgs[it.ticker]) continue; // 두 시장에 다 있으면 앞의 것
        imgs[it.ticker] = it.images;
        out.push({ ticker: it.ticker, held: it.held, market: m.key, info: it.info, order: out.length });
      }
    }
    return { rows: out, images: imgs };
  }, [markets]);
  const ctl = useStockList(rows);
  const [limit, setLimit] = useState(pageSize ?? Number.POSITIVE_INFINITY);
  // 필터·정렬이 바뀌면 처음 한 쪽으로
  useEffect(() => setLimit(pageSize ?? Number.POSITIVE_INFINITY), [ctl.shown, pageSize]);
  const items = ctl.shown;
  const visible = items.slice(0, limit);
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  const visibleGolden = golden.filter((g) => ctl.filters.market === "all" || g.market === ctl.filters.market);

  // 필터를 비운 목록이 다시 그려진 다음에 그 종목 카드로 이동
  useEffect(() => {
    if (!jumpTo) return;
    document.getElementById(anchorId(jumpTo))?.scrollIntoView({ block: "start" });
    setJumpTo(null);
  }, [jumpTo, visible]);

  if (rows.length === 0) return <p className="card empty">{t.charts.noneToday}</p>;

  const showChart = (ticker: string) => {
    ctl.reset();
    setJumpTo(ticker);
  };
  // 바로가기: 아직 안 그린 종목이면 거기까지 늘린 다음 이동
  const jump = (ticker: string) => {
    const i = items.findIndex((x) => x.ticker === ticker);
    if (i >= limit) setLimit(i + 1);
    setJumpTo(ticker);
  };

  return (
    <>
      <StockControls ctl={ctl} idPrefix="charts" />
      <GoldenPanel lists={visibleGolden} onShowChart={showChart} />
      <SqueezePanel squeeze={squeeze} known={known} charted={markets.flatMap((m) => m.items.map((it) => it.ticker))}
        onShowChart={showChart} />

      <details className="card" style={{ padding: "12px 20px" }}>
        <summary className="small" style={{ cursor: "pointer", minHeight: 32, display: "flex", alignItems: "center" }}>
          {t.charts.jump} · <span className="num" style={{ fontWeight: 600, margin: "0 2px" }}>{t.charts.jumpCount(items.length)[0]}</span>
          {t.charts.jumpCount(items.length)[1]}
        </summary>
        <nav className="jump" aria-label={t.charts.jump} style={{ marginTop: 10 }}>
          {items.map((it) => (
            <a key={it.ticker} href={`#${anchorId(it.ticker)}`} data-held={it.held}
              onClick={(e) => { e.preventDefault(); jump(it.ticker); }}>
              {it.ticker}
            </a>
          ))}
        </nav>
      </details>

      {items.length === 0 && <p className="card empty">{t.list.empty}</p>}

      {visible.map((it) => (
        <section key={it.ticker} id={anchorId(it.ticker)} className="card chart-section" aria-labelledby={`${anchorId(it.ticker)}-t`}
          style={{ scrollMarginTop: 16 }}>
          <div className="chart-section__head">
            <h2 id={`${anchorId(it.ticker)}-t`}>
              <Link href={stockHref(it.ticker)} style={{ color: "inherit", textDecoration: "none" }}>
                {it.ticker}
              </Link>
            </h2>
            {it.info?.company && <span style={{ color: "var(--ink-2)", fontSize: 14 }}>{it.info.company}</span>}
            {it.held && <span className="badge badge--held">{t.common.held}</span>}
            {ctl.filters.market === "all" && it.market && (
              <span className="chip">{it.market === "sp500" ? "S&P 500" : term(lang, "나스닥·NYSE")}</span>
            )}
            <span className="chart-section__price">
              {it.info?.price != null && (
                <span className="num" style={{ fontSize: 18, fontWeight: 600 }}>
                  {usd(it.info.price)}
                </span>
              )}
              <a className="small" style={{ fontWeight: 600, textDecoration: "none" }} href={tvUrl(it.ticker)}
                target="_blank" rel="noopener noreferrer">
                TradingView ↗
              </a>
            </span>
          </div>
          {it.info ? (
            <StockChips info={it.info} />
          ) : (
            <p className="small muted" style={{ margin: "6px 0 0" }}>{t.charts.noSummary}</p>
          )}
          <ChartGrid ticker={it.ticker} images={images[it.ticker]} tfs={ctl.tfs} />
        </section>
      ))}

      {visible.length < items.length && (
        <div className="card" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "14px 20px" }}>
          <button type="button" className="btn btn--primary" onClick={() => setLimit((v) => v + (pageSize ?? 30))}>
            {t.charts.more(Math.min(pageSize ?? 30, items.length - visible.length))}
          </button>
          <span className="small muted">{t.charts.showing(visible.length, items.length)}</span>
        </div>
      )}

      <a className="btn to-top" href="#top">
        {t.charts.toTop}
      </a>
    </>
  );
}
