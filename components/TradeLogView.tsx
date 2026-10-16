"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useT } from "./LangProvider";
import { exitReason, term } from "@/lib/i18n";
import { fmtDate, pct, pp, stockHref, tone, usd } from "@/lib/format";
import type { Account } from "@/lib/types";

type Filter = "all" | "win" | "loss";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** 거래로그 — 계좌를 고르면 성적 요약 + 청산 기록(같은 기간 SPY 대비) + 보유 중. */
export function TradeLogView({ accounts }: { accounts: Account[] }) {
  const { lang, t } = useT();
  const T = t.trades;
  const [key, setKey] = useState(accounts[0]?.key ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const acct = accounts.find((a) => a.key === key) ?? accounts[0];
  const log = useMemo(() => acct?.log ?? [], [acct]);
  const stats = useMemo(() => {
    const rets = log.map((x) => x.return).filter((v): v is number => v != null);
    const ex = log.map((x) => x.vs_spy).filter((v): v is number => v != null);
    return {
      n: log.length,
      win: rets.length ? rets.filter((v) => v > 0).length / rets.length : null,
      avg: mean(rets),
      avgEx: mean(ex),
      beat: ex.length ? ex.filter((v) => v > 0).length / ex.length : null,
      beatN: ex.filter((v) => v > 0).length,
      exN: ex.length,
    };
  }, [log]);
  if (!acct) return <p className="card empty">{T.none}</p>;
  const rows = log.filter((x) => filter === "all" || (filter === "win" ? (x.return ?? 0) > 0 : (x.return ?? 0) <= 0));
  const d = acct.dollar;

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
          <div className="tile__sub">{T.avgRet} <span className={tone(stats.avg)}>{pct(stats.avg)}</span></div>
        </div>
        <div className="card tile">
          <div className="tile__label">{T.avgVsSpy}</div>
          <div className={`tile__value ${tone(stats.avgEx)}`}>{stats.avgEx != null ? pp(stats.avgEx, 0) : "—"}</div>
          <div className="tile__sub">{T.beatSpy} {pct(stats.beat, 0, false)} ({stats.beatN}/{stats.exN})</div>
        </div>
      </section>

      <section className="card" aria-labelledby="tl-title">
        <div className="section-head">
          <h2 id="tl-title">{T.tableTitle}</h2>
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
            <table className="data-table data-table--tight" style={{ minWidth: 1020 }}>
              <thead>
                <tr>
                  <th scope="col">{T.colTicker}</th>
                  <th scope="col">{T.colEntry} → {T.colExit}</th>
                  <th scope="col" className="r">{T.colBuy} → {T.colSell}</th>
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
                    <td className="r num">{usd(x.entry_price)} → {usd(x.exit_price)}</td>
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
        <p className="tiny muted" style={{ margin: "10px 0 0" }}>{T.note}</p>
      </section>

      <section className="card" aria-labelledby="tl-open">
        <div className="section-head">
          <h2 id="tl-open">{T.openTitle}</h2>
        </div>
        {acct.positions.length === 0 ? (
          <p className="muted" style={{ margin: "12px 0 0" }}>{T.noOpen}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--tight" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th scope="col">{T.colTicker}</th>
                  <th scope="col">{T.colEntry}</th>
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
