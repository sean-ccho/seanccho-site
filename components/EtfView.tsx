"use client";

import { Fragment, useMemo, useState } from "react";
import { useChartPrefs } from "./ChartPrefs";
import { EtfDetailPanel, etfMoney } from "./EtfDetail";
import { EtfPicks } from "./EtfPicks";
import { useT } from "./LangProvider";
import { SortTh, useTableSort, type SortCol } from "./SortTh";
import { TvChart } from "./TvChart";
import type { EtfData, EtfItem, EtfTwin } from "@/lib/etf";
import { num, pct, tone, tvSymbol, tvUrl } from "@/lib/format";
import { crossName, crossTitle } from "@/lib/patternHelp";
import { CROSS_KIND, type BarTf } from "@/lib/stockList";
import type { Timeframe } from "@/lib/types";

const RET_KEYS = ["w1", "m1", "m3", "m6", "y1", "ytd"] as const;
const BAR_TFS: BarTf[] = ["daily", "weekly", "monthly"];
const CHART_TFS: Timeframe[] = ["Daily", "Weekly", "Monthly"];

const SORT_COLS = {
  ticker: { get: (r) => r.ticker, first: "asc" },
  w1: { get: (r) => r.ret.w1 },
  m1: { get: (r) => r.ret.m1 },
  m3: { get: (r) => r.ret.m3 },
  m6: { get: (r) => r.ret.m6 },
  y1: { get: (r) => r.ret.y1 },
  ytd: { get: (r) => r.ret.ytd },
  high: { get: (r) => r.high_52w_gap },
  vol: { get: (r) => r.vol, first: "asc" },
  mdd: { get: (r) => r.mdd_1y },
  corr: { get: (r) => r.corr_spy, first: "asc" },
  expense: { get: (r) => r.expense, first: "asc" },
  aum: { get: (r) => r.aum },
  yield: { get: (r) => r.yield },
} satisfies Record<string, SortCol<EtfItem>>;

/** 추세 칸 — 200일선 · 12개월 추세 · 일·주·월 교차 라벨 (마우스를 올리면 설명). */
function TrendChips({ r }: { r: EtfItem }) {
  const { t } = useT();
  const E = t.etf;
  return (
    <span className="etf-trend">
      {r.above_200 != null && (
        <span className={`badge ${r.above_200 ? "badge--good" : "badge--bad"}`} title={E.help.above200}>
          {r.above_200 ? "▲" : "▼"} {E.ma200}
        </span>
      )}
      {r.trend_12m != null && (
        <span className={`badge ${r.trend_12m ? "badge--good" : "badge--bad"}`} title={E.help.trend12m}>
          {r.trend_12m ? "▲" : "▼"} {E.trend12m}
        </span>
      )}
      {BAR_TFS.map((tf) => {
        const c = r.cross[tf];
        const kind = c.label ? CROSS_KIND[c.label] : undefined;
        if (!kind) return null;
        const up = kind.startsWith("golden");
        return (
          <span key={tf} className={`badge ${up ? "badge--good" : "badge--bad"}`} title={crossTitle(t, kind, tf, c.gap)}>
            {up ? "▲" : "▼"} {crossName(t.list, kind)} · {E.tfShort[tf]}
          </span>
        );
      })}
    </span>
  );
}

/**
 * ETF 탭 — 맨 위 '역할별 기본 1개 · 요즘 강한 ETF' + 묶음 버튼(모두 · 미국 시장 전체 · 섹터 · …) + 검색 + 정렬되는 표.
 * 줄을 누르면 설명 · 보유 종목 · 섹터 비중(EtfDetailPanel) + TradingView 실시간 차트 (일·주·월).
 * 수익률은 배당 포함 총수익, 교차 라벨은 주식 화면과 같은 차트 규칙 (EMA10/20 · 끝난 봉).
 */
export function EtfView({ data }: { data: EtfData }) {
  const { lang, t } = useT();
  const E = t.etf;
  const { studies } = useChartPrefs();
  const [group, setGroup] = useState<string>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [chartTf, setChartTf] = useState<Timeframe>("Daily");
  const { sort, toggle, apply } = useTableSort<EtfItem, keyof typeof SORT_COLS>(SORT_COLS);

  const groupName = (key: string) => {
    const g = data.groups.find((x) => x.key === key);
    return g ? (lang === "en" ? g.en : g.ko) : key;
  };
  const order = useMemo(() => new Map(data.groups.flatMap((g) => g.tickers).map((tk, i) => [tk, i])), [data]);
  const byTicker = useMemo(() => new Map(data.items.map((r) => [r.ticker, r])), [data]);
  const twinOf = useMemo(() => {
    const m = new Map<string, EtfTwin>();
    for (const tw of data.twins ?? []) for (const tk of tw.tickers) m.set(tk, tw);
    return m;
  }, [data]);
  const roleOf = useMemo(() => new Map((data.picks?.roles ?? []).map((p) => [p.pick, lang === "en" ? p.en : p.ko])), [data, lang]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data.items) m.set(r.group, (m.get(r.group) ?? 0) + 1);
    return m;
  }, [data]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = data.items
      .filter((r) => group === "all" || r.group === group)
      .filter((r) => !needle || r.ticker.toLowerCase().includes(needle) || (r.name ?? "").toLowerCase().includes(needle))
      .sort((a, b) => (order.get(a.ticker) ?? 0) - (order.get(b.ticker) ?? 0));
    return apply(base);
  }, [data, group, q, order, apply]);
  const colSpan = 2 + RET_KEYS.length + 1 + 7;

  /** 추천 카드 · 상세의 다른 ETF 를 누르면 — 그 줄이 보이게 묶음 · 검색을 풀고 펼친 뒤 그 줄로 내려간다. */
  const openEtf = (tk: string) => {
    const r = byTicker.get(tk);
    if (!r) return;
    if (group !== "all" && group !== r.group) setGroup("all");
    const needle = q.trim().toLowerCase();
    if (needle && !r.ticker.toLowerCase().includes(needle) && !(r.name ?? "").toLowerCase().includes(needle)) setQ("");
    setOpen(tk);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.getElementById(`etf-${tk}`)?.scrollIntoView({ behavior: "smooth", block: "start" })),
    );
  };
  // 묶음 제목 줄 — '모두'를 기본 순서로 볼 때만 (정렬 · 검색 중엔 섞이므로 이름 앞에 묶음을 붙인다)
  const sections = group === "all" && !sort && !q.trim();
  const blocks: { key: string; rows: EtfItem[] }[] = sections
    ? data.groups.map((g) => ({ key: g.key, rows: rows.filter((r) => r.group === g.key) })).filter((b) => b.rows.length)
    : [{ key: "", rows }];

  return (
    <>
      {data.picks && <EtfPicks picks={data.picks} byTicker={byTicker} onOpen={openEtf} />}
      <section className="card controls" aria-label={E.controls}>
        <div className="ctl-grid">
          <div className="ctl-group ctl-group--wide" role="group" aria-label={E.groupsAria}>
            <span className="ctl-group__label">{E.groupLabel}</span>
            <div className="tseg tseg--wrap">
              <button type="button" aria-pressed={group === "all"} onClick={() => setGroup("all")}>
                {E.all} <span className="tseg__count">{data.items.length}</span>
              </button>
              {data.groups.filter((g) => counts.get(g.key)).map((g) => (
                <button key={g.key} type="button" aria-pressed={group === g.key} onClick={() => setGroup(g.key)}>
                  {lang === "en" ? g.en : g.ko} <span className="tseg__count">{counts.get(g.key)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="controls__foot">
          <div className="ctl-search">
            <label htmlFor="etf-search" className="sr-only">{E.search}</label>
            <input id="etf-search" className="input" type="search" value={q} placeholder={E.searchPh}
              autoComplete="off" spellCheck={false} onChange={(e) => setQ(e.target.value)} />
          </div>
          <span role="status" className="controls__count">
            <span className="num" style={{ fontWeight: 600, color: "var(--ink)" }}>{rows.length}</span> / {data.items.length}
          </span>
        </div>
        <p className="tiny muted" style={{ margin: "8px 0 0" }}>{E.note(data.risk_free)}</p>
      </section>

      <section className="card">
        <div className="table-wrap etf-table-wrap">
          <table className="data-table data-table--tight" style={{ minWidth: 1180 }}>
            <thead>
              <tr>
                <SortTh k="ticker" sort={sort} onSort={toggle}>{E.colEtf}</SortTh>
                <th scope="col" className="r">{E.colPrice}</th>
                {RET_KEYS.map((k) => (
                  <SortTh key={k} k={k} sort={sort} onSort={toggle} className="r" title={E.help.ret}>{E.ret[k]}</SortTh>
                ))}
                <th scope="col" title={E.help.trend}>{E.colTrend}</th>
                <SortTh k="high" sort={sort} onSort={toggle} className="r" title={E.help.high}>{E.colHigh}</SortTh>
                <SortTh k="vol" sort={sort} onSort={toggle} className="r" title={E.help.vol}>{E.colVol}</SortTh>
                <SortTh k="mdd" sort={sort} onSort={toggle} className="r" title={E.help.mdd}>{E.colMdd}</SortTh>
                <SortTh k="corr" sort={sort} onSort={toggle} className="r" title={E.help.corr}>{E.colCorr}</SortTh>
                <SortTh k="expense" sort={sort} onSort={toggle} className="r" title={E.help.expense}>{E.colExpense}</SortTh>
                <SortTh k="aum" sort={sort} onSort={toggle} className="r" title={E.help.aum}>{E.colAum}</SortTh>
                <SortTh k="yield" sort={sort} onSort={toggle} className="r" title={E.help.yield}>{E.colYield}</SortTh>
              </tr>
            </thead>
            <tbody>
              {blocks.map((blk) => (
                <Fragment key={blk.key || "rows"}>
                  {blk.key && (
                    <tr className="etf-group-row">
                      <th colSpan={colSpan} scope="colgroup">
                        {groupName(blk.key)} <span className="tseg__count">{blk.rows.length}</span>
                      </th>
                    </tr>
                  )}
                  {blk.rows.map((r) => (
                <Fragment key={r.ticker}>
                  <tr id={`etf-${r.ticker}`} className={open === r.ticker ? "is-open" : undefined}>
                    <td>
                      <button type="button" className="etf-tick" aria-expanded={open === r.ticker}
                        onClick={() => setOpen(open === r.ticker ? null : r.ticker)} title={E.help.openChart}>
                        <span className="tick">{r.ticker}</span> <span aria-hidden="true">{open === r.ticker ? "▾" : "▸"}</span>
                      </button>
                      {roleOf.has(r.ticker) && (
                        <span className="badge badge--good etf-mark" title={E.picks.baseTitle(roleOf.get(r.ticker)!)}>⭐ {E.picks.base}</span>
                      )}
                      {twinOf.has(r.ticker) && (() => {
                        const tw = twinOf.get(r.ticker)!;
                        const others = tw.tickers.filter((x) => x !== r.ticker).join("·");
                        return (
                          <span className="tiny muted etf-mark" title={E.twin.title(tw.kind, lang === "en" ? tw.en : tw.ko, tw.tickers.join(" · "))}>
                            {E.twin.mark(tw.kind, others)}
                          </span>
                        );
                      })()}
                      <div className="cell-sub etf-name" title={[r.name, r.family, r.category, r.inception && E.inception(r.inception)].filter(Boolean).join("\n")}>
                        {group === "all" && !sections ? `${groupName(r.group)} · ` : ""}{r.name ?? "—"}
                      </div>
                    </td>
                    <td className="r num nowrap">
                      {num(r.price, 2)} <span className="tiny muted">{r.currency ?? ""}</span>
                    </td>
                    {RET_KEYS.map((k) => (
                      <td key={k} className={`r num ${tone(r.ret[k])}`}>{pct(r.ret[k])}</td>
                    ))}
                    <td className="small"><TrendChips r={r} /></td>
                    <td className={`r num ${tone(r.high_52w_gap)}`}>{pct(r.high_52w_gap)}</td>
                    <td className="r num">{pct(r.vol, 1, false)}</td>
                    <td className={`r num ${tone(r.mdd_1y)}`}>{pct(r.mdd_1y)}</td>
                    <td className="r num">{num(r.corr_spy, 2)}</td>
                    <td className="r num">{pct(r.expense, 2, false)}</td>
                    <td className="r num">{etfMoney(r.aum, r.currency)}</td>
                    <td className="r num">{pct(r.yield, 1, false)}</td>
                  </tr>
                  {open === r.ticker && (
                    <tr className="etf-chart-row">
                      <td colSpan={colSpan}>
                        <EtfDetailPanel item={r} twin={twinOf.get(r.ticker)} byTicker={byTicker} onOpen={openEtf} />
                        <div className="tseg" role="group" aria-label={E.chartTfAria} style={{ marginBottom: 8 }}>
                          {CHART_TFS.map((tf) => (
                            <button key={tf} type="button" aria-pressed={chartTf === tf} onClick={() => setChartTf(tf)}>
                              {t.common.tf[tf]}
                            </button>
                          ))}
                          <a className="link-strong small" style={{ marginLeft: 12 }} href={tvUrl(r.ticker)} target="_blank"
                            rel="noopener noreferrer">TradingView ↗</a>
                        </div>
                        <TvChart symbol={tvSymbol(r.ticker)} tf={chartTf} studies={studies} lang={lang}
                          label={t.common.liveAlt(r.ticker, t.common.tf[chartTf])} />
                      </td>
                    </tr>
                  )}
                </Fragment>
                  ))}
                </Fragment>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="muted">{E.empty}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="tiny muted" style={{ margin: "8px 0 0" }}>{t.list.sortHint}</p>
      </section>
    </>
  );
}
