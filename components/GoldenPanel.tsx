"use client";

import Link from "next/link";
import { useT } from "./LangProvider";
import { PanelHint } from "./PanelHint";
import type { GoldenList } from "@/lib/dashboard";
import { num, pct, stockHref, tvUrl } from "@/lib/format";
import { term } from "@/lib/i18n";

/** PT 골든크로스 목록 (시장별) — 이 화면 목록에 있는 종목은 '차트 보기', 없으면 TradingView. */
export function GoldenPanel({ lists, onShowChart }: { lists: GoldenList[]; onShowChart: (ticker: string) => void }) {
  const { lang, t } = useT();
  const L = t.list;
  const total = lists.reduce((s, l) => s + l.items.length, 0);
  if (total === 0) return null;
  const marketLabel = (k: string) => (k === "sp500" ? "S&P 500" : term(lang, "나스닥·NYSE"));
  return (
    <details className="card panel">
      <summary>
        <span className="panel__title up">▲ {L.goldenTitle}</span>
        {lists.map((l) => (
          <span key={l.market} className="chip">
            {marketLabel(l.market)} <span className="num" style={{ fontWeight: 600 }}>{l.items.length}</span>
          </span>
        ))}
        <PanelHint />
      </summary>
      <p className="small muted" style={{ margin: "10px 0 0" }}>{L.goldenSub}</p>
      {lists.filter((l) => l.items.length > 0).map((l) => (
        <div key={l.market} style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 14 }}>
            {marketLabel(l.market)} · {L.goldenCount(l.items.length)}
          </h3>
          <div className="table-wrap">
            <table className="data-table data-table--tight" style={{ minWidth: 700 }}>
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
                      {g.listed ? (
                        <button type="button" className="btn btn--small" onClick={() => onShowChart(g.ticker)}>
                          {L.toChart}
                        </button>
                      ) : (
                        <a className="link-strong small" href={tvUrl(g.ticker)} target="_blank" rel="noopener noreferrer">
                          TradingView ↗
                        </a>
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
