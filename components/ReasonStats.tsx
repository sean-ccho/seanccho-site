"use client";

import { useT } from "./LangProvider";
import { pct, pp, tone, usd } from "@/lib/format";
import { MIN_JUDGE, type ReasonStat } from "@/lib/journalStats";

function VerdictBadge({ s }: { s: ReasonStat }) {
  const { t } = useT();
  const v = s.verdict;
  const cls = v === "better" ? "badge--good" : v === "worse" ? "badge--bad" : "badge--mid";
  const label = v === "few" ? t.journal.verdict.few(s.nSpy, MIN_JUDGE) : t.journal.verdict[v];
  return <span className={`badge ${cls}`} title={s.t != null ? `t = ${s.t.toFixed(2)}` : undefined}>{label}</span>;
}

function StatRow({ s, label, strong = false }: { s: ReasonStat; label: string; strong?: boolean }) {
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

/** 매수이유별 성적 — 판 거래(매도 완료 줄)를 같은 기간 SPY 와 비교. 판 거래가 없으면 안내만. */
export function ReasonStats({ all, byReason, hasBench }: { all: ReasonStat; byReason: ReasonStat[]; hasBench: boolean }) {
  const { t } = useT();
  return (
    <section className="card" aria-labelledby="reason-title">
      <div className="section-head">
        <h2 id="reason-title">{t.journal.summaryTitle}</h2>
        <p>{t.account.reasonSub}</p>
      </div>
      {!hasBench && <p className="small" style={{ margin: "8px 0 0", color: "var(--warn)" }}>{t.journal.noBench}</p>}
      {all.n === 0 ? (
        <p className="muted" style={{ margin: "12px 0 0" }}>{t.account.noClosed}</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table data-table--tight" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th scope="col">{t.journal.colReason}</th>
                  <th scope="col" className="r">{t.journal.colN}</th>
                  <th scope="col" className="r">{t.journal.colWin}</th>
                  <th scope="col" className="r">{t.journal.colAvgRet}</th>
                  <th scope="col" className="r">{t.journal.colAvgSpy}</th>
                  <th scope="col" className="r">{t.journal.colExcess}</th>
                  <th scope="col" className="r">{t.journal.colBeat}</th>
                  <th scope="col" className="r">{t.journal.colPnl}</th>
                  <th scope="col" className="r">{t.journal.colDays}</th>
                  <th scope="col">{t.journal.colVerdict}</th>
                </tr>
              </thead>
              <tbody>
                <StatRow s={all} label={t.journal.all} strong />
                {byReason.map((s) => <StatRow key={s.reason || "-"} s={s} label={s.reason || t.journal.noReason} />)}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ margin: "10px 0 0" }}>{t.journal.verdictNote}</p>
        </>
      )}
    </section>
  );
}
