"use client";

import { useState } from "react";
import { useT } from "./LangProvider";
import { pct, pp, tone, usd } from "@/lib/format";
import { MIN_JUDGE, type ReasonStat, type StopGroup } from "@/lib/journalStats";

type Summary = { all: ReasonStat; byReason: ReasonStat[] };
type View = "buy" | "sell" | "stop";
const VIEWS: View[] = ["buy", "sell", "stop"];

function VerdictBadge({ s }: { s: ReasonStat }) {
  const { t } = useT();
  const v = s.verdict;
  const cls = v === "better" ? "badge--good" : v === "worse" ? "badge--bad" : "badge--mid";
  const label = v === "few" ? t.journal.verdict.few(s.nSpy, MIN_JUDGE) : t.journal.verdict[v];
  return <span className={`badge ${cls}`} title={s.t != null ? `t = ${s.t.toFixed(2)}` : undefined}>{label}</span>;
}

/** 짧은 줄 — 묶음 · 매매 · 승률 · 평균 수익 · SPY 대비 · 손익 · 판단 (리스크 카드 안에 들어가는 폭). */
function ShortRow({ s, label, strong = false }: { s: ReasonStat; label: string; strong?: boolean }) {
  return (
    <tr style={strong ? { fontWeight: 600 } : undefined}>
      <td>{label}</td>
      <td className="r num">{s.n}</td>
      <td className="r num">{s.n ? pct(s.wins / s.n, 0, false) : "—"}</td>
      <td className={`r num ${tone(s.avgRet)}`}>{pct(s.avgRet)}</td>
      <td className={`r num ${tone(s.avgExcess)}`}>{s.avgExcess != null ? pp(s.avgExcess, 0) : "—"}</td>
      <td className={`r num ${tone(s.pnl)}`}>{usd(s.pnl, 0)}</td>
      <td><VerdictBadge s={s} /></td>
    </tr>
  );
}

function FullRow({ s, label, strong = false }: { s: ReasonStat; label: string; strong?: boolean }) {
  const { t } = useT();
  return (
    <tr style={strong ? { fontWeight: 600 } : undefined}>
      <td>{label}</td>
      <td className="r num">{s.n}</td>
      <td className="r num">{s.n ? pct(s.wins / s.n, 0, false) : "—"}</td>
      <td className={`r num ${tone(s.avgRet)}`}>{pct(s.avgRet)}</td>
      <td className="r num">{pct(s.avgSpy)}</td>
      <td className={`r num ${tone(s.avgExcess)}`}>{s.avgExcess != null ? pp(s.avgExcess, 0) : "—"}</td>
      <td className="r num">{s.nSpy ? `${pct(s.beat / s.nSpy, 0, false)} (${s.beat}/${s.nSpy})` : "—"}</td>
      <td className={`r num ${tone(s.pnl)}`}>{usd(s.pnl, 0)}</td>
      <td className="r num">{s.avgDays != null ? t.journal.days(s.avgDays) : "—"}</td>
      <td><VerdictBadge s={s} /></td>
    </tr>
  );
}

/**
 * 판 거래 성적 — 같은 기간 SPY 와 비교 (2026-11-26 리스크 카드 안: 짧은 표 + '표 전체 보기').
 * 묶는 기준 셋: 매수 이유 · 매도 이유(매도 폼에서 고른 값) · 손절가(판 가격이 그때 손절가 위였나). 판 거래가 없으면 한 줄 안내만.
 */
export function ReasonStats({ buy, sell, stop, hasBench }: { buy: Summary; sell: Summary; stop: Summary; hasBench: boolean }) {
  const { t } = useT();
  const J = t.journal;
  const A = t.account;
  const [view, setView] = useState<View>("buy");
  const cur = view === "buy" ? buy : view === "sell" ? sell : stop;
  const label = (s: ReasonStat) =>
    view === "buy" ? s.reason || J.noReason
      : view === "sell" ? (s.reason ? A.sellWhy[s.reason] ?? s.reason : A.sellWhyNone)
        : A.stopGroup[s.reason as StopGroup] ?? s.reason;
  const all = cur.all;
  return (
    <div className="acct-reasons">
      <div className="acct-reasons__head">
        <h3 id="reason-title">{A.statsTitle[view]}</h3>
        {all.n === 0 ? (
          <span className="muted">{t.risk.reasonsNone}</span>
        ) : (
          <div className="seg seg--small acct-reasons__views" role="group" aria-label={A.statsViewAria}>
            {VIEWS.map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{A.statsView[v]}</button>
            ))}
          </div>
        )}
      </div>
      {all.n > 0 && <p className="tiny muted acct-reasons__sub">{A.reasonSub}</p>}
      {!hasBench && <p className="small" style={{ margin: "6px 0 0", color: "var(--warn)" }}>{J.noBench}</p>}
      {all.n > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table data-table--tight acct-reasons__table" aria-labelledby="reason-title">
              <thead>
                <tr>
                  <th scope="col">{A.statsCol[view]}</th>
                  <th scope="col" className="r">{J.colN}</th>
                  <th scope="col" className="r">{J.colWin}</th>
                  <th scope="col" className="r">{J.colAvgRet}</th>
                  <th scope="col" className="r">{J.colExcess}</th>
                  <th scope="col" className="r">{J.colPnl}</th>
                  <th scope="col">{J.colVerdict}</th>
                </tr>
              </thead>
              <tbody>
                <ShortRow s={all} label={J.all} strong />
                {cur.byReason.map((s) => <ShortRow key={s.reason || "-"} s={s} label={label(s)} />)}
              </tbody>
            </table>
          </div>
          <details className="acct-reasons__full">
            <summary>{t.risk.reasonsFull}</summary>
            <div className="table-wrap">
              <table className="data-table data-table--tight data-table--pin" style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th scope="col">{A.statsCol[view]}</th>
                    <th scope="col" className="r">{J.colN}</th>
                    <th scope="col" className="r">{J.colWin}</th>
                    <th scope="col" className="r">{J.colAvgRet}</th>
                    <th scope="col" className="r">{J.colAvgSpy}</th>
                    <th scope="col" className="r">{J.colExcess}</th>
                    <th scope="col" className="r">{J.colBeat}</th>
                    <th scope="col" className="r">{J.colPnl}</th>
                    <th scope="col" className="r">{J.colDays}</th>
                    <th scope="col">{J.colVerdict}</th>
                  </tr>
                </thead>
                <tbody>
                  <FullRow s={all} label={J.all} strong />
                  {cur.byReason.map((s) => <FullRow key={s.reason || "-"} s={s} label={label(s)} />)}
                </tbody>
              </table>
            </div>
          </details>
          <p className="tiny muted" style={{ margin: "8px 0 0" }}>
            {view === "stop" ? `${A.stopGroupNote} ` : view === "sell" ? `${A.sellViewNote} ` : ""}
            {J.verdictNote}
          </p>
        </>
      )}
    </div>
  );
}
