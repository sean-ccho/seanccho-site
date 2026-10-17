"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useT } from "./LangProvider";
import { exitReason, term } from "@/lib/i18n";
import { fmtDate, pct, pp, stockHref, tone, usd } from "@/lib/format";
import type { Account, SheetLogRow, TradeLogItem } from "@/lib/types";

type Filter = "all" | "win" | "loss";
type View = "closed" | "sheet";

type Group = { label: string; trades: TradeLogItem[] };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** 0주(자리 몫으로 1주도 못 산) 거래는 성적에서 뺀다 — $5,000 계좌 요약·시트 성과요약과 같게. */
const counted = (log: TradeLogItem[]) => log.filter((x) => x.shares !== 0 && x.return != null);

/** 시트 [페이퍼_성과요약] 과 같은 줄: 전체 · 전략별 · 별점별. */
function groups(log: TradeLogItem[], T: { all: string; other: string; otherStar: string }): Group[] {
  const by = (pick: (x: TradeLogItem) => string, order: string[]) => {
    const m = new Map<string, TradeLogItem[]>();
    for (const x of log) m.set(pick(x), [...(m.get(pick(x)) ?? []), x]);
    return order.filter((k) => m.has(k)).map((k) => ({ label: k, trades: m.get(k) as TradeLogItem[] }));
  };
  const strat = (x: TradeLogItem) => ((x.strategy ?? "").includes("바닥반등") ? "바닥반등" : (x.strategy ?? "").includes("모멘텀") ? "모멘텀" : T.other);
  const star = (x: TradeLogItem) => ((x.star ?? "").includes("★★★★★") ? "★5" : (x.star ?? "").includes("★★★★") ? "★4" : T.otherStar);
  return [{ label: T.all, trades: log }, ...by(strat, ["바닥반등", "모멘텀", T.other]), ...by(star, ["★5", "★4", T.otherStar])];
}

function groupStats(trades: TradeLogItem[]) {
  const r = trades.map((x) => x.return as number);
  const pairs = trades.filter((x) => x.spy_return != null);
  const ex = pairs.map((x) => (x.return as number) - (x.spy_return as number));
  return {
    n: r.length,
    win: r.length ? r.filter((v) => v > 0).length / r.length : null,
    avg: mean(r),
    max: r.length ? Math.max(...r) : null,
    min: r.length ? Math.min(...r) : null,
    cum: r.length ? r.reduce((a, v) => a * (1 + v), 1) - 1 : null,
    spy: mean(pairs.map((x) => x.spy_return as number)),
    ex: mean(ex),
    beat: ex.length ? ex.filter((v) => v > 0).length / ex.length : null,
  };
}

/** 예전 dashboard.json (sheet_log 없음) — 청산 기록·보유로 매수·매도 줄을 대신 만든다 (금액 칸은 빈칸). */
function fallbackSheet(acct: Account): SheetLogRow[] {
  const row = (x: Partial<SheetLogRow> & Pick<SheetLogRow, "date" | "side" | "ticker">): SheetLogRow => ({
    sector: "", shares: 0, price: null, amount: null, pnl: null, ret: null, days: null, cash_after: null, strategy: null,
    star: "", ccs: null, reason: "", spy: null, vs_spy: null, ...x,
  });
  const out = (acct.log ?? []).flatMap((x) => [
    row({ date: x.entry_date, side: "buy", ticker: x.ticker, sector: x.sector ?? "", price: x.entry_price, strategy: x.strategy,
      star: x.star ?? "", ccs: x.ccs, reason: "신규매수" }),
    row({ date: x.exit_date, side: "sell", ticker: x.ticker, sector: x.sector ?? "", price: x.exit_price, ret: x.return,
      days: x.holding_days, strategy: x.strategy, star: x.star ?? "", ccs: x.ccs, reason: x.exit_reason ?? "", spy: x.spy_return,
      vs_spy: x.vs_spy }),
  ]);
  out.push(...acct.positions.map((p) => row({ date: p.entry_date, side: "buy", ticker: p.ticker, sector: p.sector ?? "",
    price: p.entry_price, strategy: p.strategy, star: p.star_rating ?? "", reason: "신규매수" })));
  return out.sort((a, b) => (a.date === b.date ? (a.side === b.side ? 0 : a.side === "sell" ? -1 : 1) : a.date < b.date ? -1 : 1));
}

/** 거래로그 — 계좌를 고르면 성적 요약 + 청산 기록 · 시트처럼(매수·매도 순서) + 성과요약 + 보유 중. 숫자는 $5,000 계좌 기준. */
export function TradeLogView({ accounts }: { accounts: Account[] }) {
  const { lang, t } = useT();
  const T = t.trades;
  const [key, setKey] = useState(accounts[0]?.key ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("closed");
  const [oldestFirst, setOldestFirst] = useState(false);
  const acct = accounts.find((a) => a.key === key) ?? accounts[0];
  const log = useMemo(() => acct?.log ?? [], [acct]);
  const stats = useMemo(() => {
    const c = counted(log);
    const rets = c.map((x) => x.return as number);
    const ex = c.map((x) => x.vs_spy).filter((v): v is number => v != null);
    const pnls = c.map((x) => x.pnl).filter((v): v is number => v != null);
    return {
      n: c.length,
      win: rets.length ? rets.filter((v) => v > 0).length / rets.length : null,
      avg: mean(rets),
      avgEx: mean(ex),
      beat: ex.length ? ex.filter((v) => v > 0).length / ex.length : null,
      beatN: ex.filter((v) => v > 0).length,
      exN: ex.length,
      realized: pnls.length ? pnls.reduce((a, b) => a + b, 0) : null,
    };
  }, [log]);
  if (!acct) return <p className="card empty">{T.none}</p>;
  const rows = log.filter((x) => filter === "all" || (filter === "win" ? (x.return ?? 0) > 0 : (x.return ?? 0) <= 0));
  const d = acct.dollar;
  const sheetRows = [...(acct.sheet_log?.length ? acct.sheet_log : fallbackSheet(acct))];
  if (!oldestFirst) sheetRows.reverse();
  const summary = groups(counted(log), T).map((g) => ({ label: g.label, ...groupStats(g.trades) }));

  return (
    <>
      <div className="seg" role="tablist" aria-label={T.account}>
        {accounts.map((a) => (
          <button key={a.key} type="button" role="tab" aria-selected={a.key === acct.key} aria-pressed={a.key === acct.key}
            className="pill" onClick={() => setKey(a.key)}>
            {term(lang, a.label)}
          </button>
        ))}
      </div>

      <section className="tiles" aria-label={T.title}>
        {d && (
          <div className="card tile">
            <div className="tile__label">{T.dollar}</div>
            <div className={`tile__value ${tone(d.return)}`}>{pct(d.return)}</div>
            <div className="tile__sub">
              {T.dollarSub(pct(d.spy_return))} · <span className={tone(d.return != null && d.spy_return != null ? d.return - d.spy_return : null)}>
                {pp(d.return, d.spy_return)}
              </span>
              <br />
              {T.since(fmtDate(d.start, lang))}
            </div>
          </div>
        )}
        <div className="card tile">
          <div className="tile__label">{T.closed} · {T.winRate}</div>
          <div className="tile__value">{stats.n} · {pct(stats.win, 0, false)}</div>
          <div className="tile__sub">
            {T.avgRet} <span className={tone(stats.avg)}>{pct(stats.avg)}</span>
            {stats.realized != null && <> · {T.realized} <span className={tone(stats.realized)}>{usd(stats.realized, 0)}</span></>}
          </div>
        </div>
        <div className="card tile">
          <div className="tile__label">{T.avgVsSpy}</div>
          <div className={`tile__value ${tone(stats.avgEx)}`}>{stats.avgEx != null ? pp(stats.avgEx, 0) : "—"}</div>
          <div className="tile__sub">{T.beatSpy} {pct(stats.beat, 0, false)} ({stats.beatN}/{stats.exN})</div>
        </div>
      </section>
      <p className="tiny muted" style={{ margin: "-6px 0 0" }}>{T.basisNote}</p>

      <section className="card" aria-labelledby="tl-title">
        <div className="section-head">
          <h2 id="tl-title">{T.tableTitle}</h2>
          <div className="seg" role="radiogroup" aria-label={T.viewSheet}>
            {(["closed", "sheet"] as View[]).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={view === v} aria-pressed={view === v}
                className="pill" onClick={() => setView(v)}>
                {v === "closed" ? T.viewClosed : T.viewSheet}
              </button>
            ))}
          </div>
        </div>

        {view === "sheet" ? (
          <>
            <div className="seg" role="radiogroup" aria-label={T.oldest} style={{ marginTop: 10 }}>
              {[false, true].map((o) => (
                <button key={String(o)} type="button" role="radio" aria-checked={oldestFirst === o} aria-pressed={oldestFirst === o}
                  className="pill" onClick={() => setOldestFirst(o)}>
                  {o ? T.oldest : T.newest}
                </button>
              ))}
            </div>
            <div className="table-wrap">
              <table className="data-table data-table--tight" style={{ minWidth: 1320 }}>
                <thead>
                  <tr>
                    <th scope="col">{T.colDate}</th>
                    <th scope="col">{T.colTicker}</th>
                    <th scope="col">{T.colAction}</th>
                    <th scope="col" className="r">{T.colShares}</th>
                    <th scope="col" className="r">{T.colPrice}</th>
                    <th scope="col" className="r">{T.colAmount}</th>
                    <th scope="col" className="r">{T.colPnl}</th>
                    <th scope="col" className="r">{T.colRet}</th>
                    <th scope="col" className="r">{T.colDays}</th>
                    <th scope="col" className="r">{T.colCash}</th>
                    <th scope="col">{T.colStrategy}</th>
                    <th scope="col">{T.colStar}</th>
                    <th scope="col" className="r">CCS</th>
                    <th scope="col">{T.colReason}</th>
                    <th scope="col" className="r">{T.colSpy}</th>
                    <th scope="col" className="r">{T.colVsSpy}</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetRows.map((r, i) => {
                    const sell = r.side === "sell";
                    return (
                      <tr key={`${i}-${r.side}-${r.ticker}-${r.date}`}>
                        <td className="small nowrap">{fmtDate(r.date, lang)}</td>
                        <td>
                          <Link className="tick" href={stockHref(r.ticker)}>{r.ticker}</Link>
                          {r.sector && <div className="cell-sub">{r.sector}</div>}
                        </td>
                        <td className="small nowrap">{sell ? T.sell : T.buy}</td>
                        <td className="r num">{r.amount != null ? r.shares : ""}</td>
                        <td className="r num">{usd(r.price)}</td>
                        <td className="r num">{r.amount != null ? usd(r.amount) : ""}</td>
                        <td className={`r num ${sell ? tone(r.pnl) : ""}`}>{sell && r.pnl != null ? usd(r.pnl) : ""}</td>
                        <td className={`r num ${sell ? tone(r.ret) : ""}`} style={{ fontWeight: 600 }}>{sell ? pct(r.ret) : ""}</td>
                        <td className="r num">{sell && r.days != null ? T.days(r.days) : ""}</td>
                        <td className="r num">{r.cash_after != null ? usd(r.cash_after) : ""}</td>
                        <td className="small">{term(lang, r.strategy)}</td>
                        <td className="small nowrap">{r.star}</td>
                        <td className="r num">{r.ccs != null ? r.ccs.toFixed(4) : ""}</td>
                        <td className="small">{sell ? exitReason(lang, r.reason) : r.reason === "신규매수" ? T.newBuy : r.reason}</td>
                        <td className="r num">{sell ? pct(r.spy) : ""}</td>
                        <td className={`r num ${sell ? tone(r.vs_spy) : ""}`}>{sell && r.vs_spy != null ? pp(r.vs_spy, 0) : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="section-head" style={{ marginTop: 10 }}>
              <span />
              <div className="seg" role="radiogroup" aria-label={T.tableTitle}>
                {(["all", "win", "loss"] as Filter[]).map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={filter === f} aria-pressed={filter === f}
                    className="pill" onClick={() => setFilter(f)}>
                    {f === "all" ? T.filterAll : f === "win" ? T.filterWin : T.filterLoss}
                  </button>
                ))}
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="muted" style={{ margin: "12px 0 0" }}>{T.none}</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table data-table--tight" style={{ minWidth: 1180 }}>
                  <thead>
                    <tr>
                      <th scope="col">{T.colTicker}</th>
                      <th scope="col">{T.colEntry} → {T.colExit}</th>
                      <th scope="col" className="r">{T.colShares}</th>
                      <th scope="col" className="r">{T.colCost} → {T.colProceeds}</th>
                      <th scope="col" className="r">{T.colPnl}</th>
                      <th scope="col" className="r">{T.colRet}</th>
                      <th scope="col" className="r">{T.colSpy}</th>
                      <th scope="col" className="r">{T.colVsSpy}</th>
                      <th scope="col" className="r">{T.colDays}</th>
                      <th scope="col">{T.colReason}</th>
                      <th scope="col">{T.colStrategy}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((x) => (
                      <tr key={`${x.ticker}-${x.entry_date}-${x.exit_date}`}>
                        <td>
                          <Link className="tick" href={stockHref(x.ticker)}>{x.ticker}</Link>
                          {x.sector && <div className="cell-sub">{x.sector}</div>}
                        </td>
                        <td className="small nowrap">{fmtDate(x.entry_date, lang)} → {fmtDate(x.exit_date, lang)}</td>
                        <td className="r num">{x.shares === 0 ? T.zeroShare : x.shares ?? "—"}</td>
                        <td className="r num">
                          {x.cost != null ? `${usd(x.cost)} → ${usd(x.proceeds)}` : `${usd(x.entry_price)} → ${usd(x.exit_price)}`}
                        </td>
                        <td className={`r num ${tone(x.pnl)}`}>{x.pnl != null ? usd(x.pnl) : "—"}</td>
                        <td className={`r num ${tone(x.return)}`} style={{ fontWeight: 600 }}>{pct(x.return)}</td>
                        <td className="r num">{pct(x.spy_return)}</td>
                        <td className={`r num ${tone(x.vs_spy)}`}>{x.vs_spy != null ? pp(x.vs_spy, 0) : "—"}</td>
                        <td className="r num">{x.holding_days != null ? T.days(x.holding_days) : "—"}</td>
                        <td className="small">{exitReason(lang, x.exit_reason)}</td>
                        <td className="small">{term(lang, x.strategy)}{x.star ? <div className="cell-sub">{x.star}</div> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <p className="tiny muted" style={{ margin: "10px 0 0" }}>{T.note}</p>
      </section>

      {summary[0]?.n > 0 && (
        <section className="card" aria-labelledby="tl-summary">
          <div className="section-head">
            <h2 id="tl-summary">{T.summaryTitle}</h2>
            <p>{T.summarySub}</p>
          </div>
          <div className="table-wrap">
            <table className="data-table data-table--tight" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th scope="col">{T.group}</th>
                  <th scope="col" className="r">{T.colN}</th>
                  <th scope="col" className="r">{T.winRate}</th>
                  <th scope="col" className="r">{T.avgRet}</th>
                  <th scope="col" className="r">{T.colMax}</th>
                  <th scope="col" className="r">{T.colMin}</th>
                  <th scope="col" className="r">{T.colCum}</th>
                  <th scope="col" className="r">{T.colSpyAvg}</th>
                  <th scope="col" className="r">{T.avgVsSpy}</th>
                  <th scope="col" className="r">{T.beatSpy}</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((g, i) => (
                  <tr key={g.label} style={i === 0 ? { fontWeight: 600 } : undefined}>
                    <td>{term(lang, g.label)}</td>
                    <td className="r num">{g.n}</td>
                    <td className="r num">{pct(g.win, 0, false)}</td>
                    <td className={`r num ${tone(g.avg)}`}>{pct(g.avg)}</td>
                    <td className="r num up">{pct(g.max)}</td>
                    <td className="r num down">{pct(g.min)}</td>
                    <td className={`r num ${tone(g.cum)}`}>{pct(g.cum)}</td>
                    <td className="r num">{pct(g.spy)}</td>
                    <td className={`r num ${tone(g.ex)}`}>{g.ex != null ? pp(g.ex, 0) : "—"}</td>
                    <td className="r num">{pct(g.beat, 0, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ margin: "10px 0 0" }}>{T.cumNote}</p>
        </section>
      )}

      <section className="card" aria-labelledby="tl-open">
        <div className="section-head">
          <h2 id="tl-open">{T.openTitle}</h2>
        </div>
        {acct.positions.length === 0 ? (
          <p className="muted" style={{ margin: "12px 0 0" }}>{T.noOpen}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--tight" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th scope="col">{T.colTicker}</th>
                  <th scope="col">{T.colEntry}</th>
                  <th scope="col" className="r">{T.colShares}</th>
                  <th scope="col" className="r">{T.colBuy} → {t.common.price}</th>
                  <th scope="col" className="r">{T.colRet}</th>
                  <th scope="col" className="r">{T.colVsSpy}</th>
                  <th scope="col" className="r">{T.colDays}</th>
                  <th scope="col">{T.colStrategy}</th>
                </tr>
              </thead>
              <tbody>
                {acct.positions.map((p) => (
                  <tr key={p.ticker}>
                    <td><Link className="tick" href={stockHref(p.ticker)}>{p.ticker}</Link></td>
                    <td className="small nowrap">{fmtDate(p.entry_date, lang)}</td>
                    <td className="r num">{p.shares ?? "—"}</td>
                    <td className="r num">{usd(p.entry_price)} → {usd(p.price)}</td>
                    <td className={`r num ${tone(p.return)}`} style={{ fontWeight: 600 }}>{pct(p.return)}</td>
                    <td className={`r num ${tone(p.return != null && p.spy_return != null ? p.return - p.spy_return : null)}`}>
                      {pp(p.return, p.spy_return)}
                    </td>
                    <td className="r num">{T.days(p.days_held)}</td>
                    <td className="small">{term(lang, p.strategy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
