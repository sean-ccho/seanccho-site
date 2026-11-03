"use client";

import { useState } from "react";
import { useT } from "./LangProvider";
import { TickerLink } from "./TickerLink";
import { SortTh, useTableSort, type SortCol } from "./SortTh";
import type { GoldenList, GoldenRow } from "@/lib/dashboard";
import { num, pct, tvUrl } from "@/lib/format";
import { term } from "@/lib/i18n";
import { crossTitle } from "@/lib/patternHelp";

const TFS = ["daily", "weekly", "monthly"] as const;
const gapOf = (g: GoldenRow, tf: (typeof TFS)[number]) => g.timeframes.find((y) => y.tf === tf)?.gap;

const SORT_COLS = {
  ticker: { get: (g) => g.ticker, first: "asc" },
  daily: { get: (g) => gapOf(g, "daily") },
  weekly: { get: (g) => gapOf(g, "weekly") },
  monthly: { get: (g) => gapOf(g, "monthly") },
  score: { get: (g) => g.score },
  vol: { get: (g) => g.vol_ratio },
} satisfies Record<string, SortCol<GoldenRow>>;

/** PT 골든크로스 목록 (후보·차트 페이지 도구 막대에서 펼치는 칸의 안쪽) — 시장이 둘이면 위 버튼으로 하나씩.
 *  이 화면 목록에 있는 종목은 '차트 보기', 없으면 TradingView. 열 이름을 누르면 그 열로 정렬 (봉 칸은 이격 %, 그 봉에 없으면 맨 아래).
 *  제목·요약·닫기는 ScreenView 가 그린다. */
export function GoldenPanel({ lists, onShowChart }: { lists: GoldenList[]; onShowChart: (ticker: string) => void }) {
  const { lang, t } = useT();
  const L = t.list;
  const { sort, toggle, apply } = useTableSort<GoldenRow, keyof typeof SORT_COLS>(SORT_COLS);
  const [pick, setPick] = useState<string | null>(null);
  const withItems = lists.filter((l) => l.items.length > 0);
  const cur = withItems.find((l) => l.market === pick) ?? withItems[0];
  if (!cur) return null;
  const marketLabel = (k: string) => (k === "sp500" ? "S&P 500" : term(lang, "나스닥·NYSE"));
  return (
    <>
      <p className="small muted">{L.goldenSub}</p>
      {withItems.length > 1 ? (
        <div className="tseg tool-panel__seg" role="group" aria-label={L.market}>
          {withItems.map((l) => (
            <button key={l.market} type="button" aria-pressed={l === cur} onClick={() => setPick(l.market)}>
              {marketLabel(l.market)} <span className="tseg__count">{l.items.length}</span>
            </button>
          ))}
        </div>
      ) : (
        <h3 className="tool-panel__sub">
          {marketLabel(cur.market)} · {L.goldenCount(cur.items.length)}
        </h3>
      )}
      <div className="table-wrap">
        <table className="data-table data-table--tight data-table--pin" style={{ minWidth: 700 }}>
          <thead>
            <tr>
              <SortTh k="ticker" sort={sort} onSort={toggle}>{t.common.ticker}</SortTh>
              <SortTh k="daily" sort={sort} onSort={toggle} title={L.gapHelp}>{t.common.tf.Daily}</SortTh>
              <SortTh k="weekly" sort={sort} onSort={toggle} title={L.gapHelp}>{t.common.tf.Weekly}</SortTh>
              <SortTh k="monthly" sort={sort} onSort={toggle} title={L.gapHelp}>{t.common.tf.Monthly}</SortTh>
              <SortTh k="score" sort={sort} onSort={toggle} className="r">{L.colScore}</SortTh>
              <SortTh k="vol" sort={sort} onSort={toggle} className="r" title={L.volHelp}>{L.colVol}</SortTh>
              <th scope="col" className="r">{t.holdings.colChart}</th>
            </tr>
          </thead>
          <tbody>
            {apply(cur.items).map((g) => (
              <tr key={g.ticker}>
                <td>
                  <TickerLink ticker={g.ticker} />
                  <div className="cell-sub" title={g.company ?? undefined}>{g.company}</div>
                </td>
                {TFS.map((tf) => {
                  const x = g.timeframes.find((y) => y.tf === tf);
                  if (!x) return <td key={tf} className="muted">—</td>;
                  const soon = x.gap != null && x.gap < 0;
                  return (
                    <td key={tf} className="small" title={crossTitle(t, soon ? "golden_soon" : "golden", tf, x.gap)}>
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
      <p className="tiny muted">{L.sortHint}</p>
    </>
  );
}
