"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useT } from "./LangProvider";
import { deleteJournal, saveJournal } from "@/app/quant/journal/actions";
import type { ActionState } from "@/lib/actionUtils";
import { fmtDate, pct, pp, tone, usd } from "@/lib/format";
import type { JournalRow } from "@/lib/journal";
import { MIN_JUDGE, type ReasonStat, type TradeCalc } from "@/lib/journalStats";

type Notice = { ok: boolean; message: string } | null;

function JournalForm({ row, onDone, onCancel }: { row: JournalRow | null; onDone: (n: Notice) => void; onCancel: () => void }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveJournal, null);
  useEffect(() => {
    if (state?.ok) onDone({ ok: true, message: state.message });
  }, [state, onDone]);
  const v = row?.input;
  const f = (name: string, label: string, el: React.ReactNode, wide = false) => (
    <label className={`field${wide ? " field--wide" : ""}`} htmlFor={`j-${name}`}>
      <span className="field__label">{label}</span>
      {el}
    </label>
  );
  return (
    <form action={action} className="card account-form" aria-label={row ? `${t.account.edit} ${row.input.ticker}` : t.journal.add}>
      <h2 style={{ fontSize: 17 }}>{row ? `${t.account.edit} · ${row.input.ticker}` : t.journal.add}</h2>
      {row && <input type="hidden" name="row" value={row.row} />}
      {row && <input type="hidden" name="expect" value={row.input.ticker} />}
      <div className="account-form__grid">
        {f("ticker", t.account.colTicker, <input id="j-ticker" name="ticker" className="input" required defaultValue={v?.ticker}
          autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="AAPL" />)}
        {f("company", `${t.account.colCompany} (${t.account.optional})`, <input id="j-company" name="company" className="input" defaultValue={v?.company} />)}
        {f("buyDate", t.account.colBuyDate, <input id="j-buyDate" name="buyDate" className="input" type="date" required defaultValue={v?.buyDate} />)}
        {f("buyPrice", t.account.colBuyPrice, <input id="j-buyPrice" name="buyPrice" className="input" inputMode="decimal" required defaultValue={v?.buyPrice} placeholder="0.00" />)}
        {f("shares", t.account.colShares, <input id="j-shares" name="shares" className="input" inputMode="decimal" required defaultValue={v?.shares} />)}
        {f("sellDate", t.journal.colSellDate, <input id="j-sellDate" name="sellDate" className="input" type="date" required defaultValue={v?.sellDate} />)}
        {f("sellPrice", t.journal.colSellPrice, <input id="j-sellPrice" name="sellPrice" className="input" inputMode="decimal" required defaultValue={v?.sellPrice} placeholder="0.00" />)}
        {f("reason", `${t.account.colReason} (${t.account.optional})`,
          <>
            <input id="j-reason" name="reason" className="input" defaultValue={v?.reason} list="j-reasons" autoComplete="off" />
            <datalist id="j-reasons">
              {t.account.reasonList.map((x) => <option key={x} value={x} />)}
            </datalist>
          </>)}
        {f("memo", `${t.account.colMemo} (${t.account.optional})`, <input id="j-memo" name="memo" className="input" defaultValue={v?.memo} />, true)}
      </div>
      {state && !state.ok && <p role="alert" className="form-msg form-msg--bad">{state.message}</p>}
      <div className="account-form__actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? t.account.saving : t.account.save}</button>
        <button type="button" className="btn" onClick={onCancel} disabled={pending}>{t.account.cancel}</button>
      </div>
    </form>
  );
}

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

function DeleteTrade({ row, action, pending }: { row: JournalRow; action: (f: FormData) => void; pending: boolean }) {
  const { t } = useT();
  return (
    <form action={action} onSubmit={(e) => {
      if (!window.confirm(t.journal.confirmDel(row.input.ticker))) e.preventDefault();
    }}>
      <input type="hidden" name="row" value={row.row} />
      <input type="hidden" name="expect" value={row.input.ticker} />
      <button type="submit" className="btn btn--small btn--danger" disabled={pending} aria-label={`${t.account.del} ${row.input.ticker}`}>
        {t.account.del}
      </button>
    </form>
  );
}

/** 매매일지 — 이유별 성적 + 매매 기록 (같은 기간 SPY 와 비교) + 추가·수정·삭제. */
export function JournalView({ trades, all, byReason, hasBench, sheetUrl }: {
  trades: TradeCalc[];
  all: ReasonStat;
  byReason: ReasonStat[];
  hasBench: boolean;
  sheetUrl: string;
}) {
  const { lang, t } = useT();
  const router = useRouter();
  const [editing, setEditing] = useState<JournalRow | "new" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [refreshing, startRefresh] = useTransition();
  const [delState, delAction, delPending] = useActionState<ActionState, FormData>(deleteJournal, null);

  useEffect(() => {
    if (delState) setNotice({ ok: delState.ok, message: delState.message });
  }, [delState]);
  useEffect(() => setNotice(null), [lang]);
  const finish = useCallback((n: Notice) => {
    setNotice(n);
    if (n?.ok) setEditing(null);
  }, []);
  const open = (e: JournalRow | "new") => {
    setNotice(null);
    setEditing(e);
    requestAnimationFrame(() => document.getElementById("journal-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const sorted = [...trades].sort((a, b) => b.row.input.sellDate.localeCompare(a.row.input.sellDate) || b.row.row - a.row.row);

  return (
    <>
      {!hasBench && <p className="form-msg form-msg--bad" role="status">{t.journal.noBench}</p>}
      {notice && <p role="status" className={`form-msg ${notice.ok ? "form-msg--good" : "form-msg--bad"}`}>{notice.message}</p>}

      <section className="card" aria-labelledby="jr-sum-title">
        <div className="section-head">
          <h2 id="jr-sum-title">{t.journal.summaryTitle}</h2>
        </div>
        {trades.length === 0 ? (
          <p className="muted" style={{ margin: "12px 0 0" }}>{t.journal.empty}</p>
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

      <section className="card" aria-labelledby="jr-trades-title">
        <div className="section-head">
          <h2 id="jr-trades-title">{t.journal.tradesTitle}</h2>
        </div>
        <div className="account-toolbar">
          <button type="button" className="btn btn--primary" onClick={() => open("new")}>+ {t.journal.add}</button>
          <button type="button" className="btn" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
            {t.account.refresh}
          </button>
          <a className="link-strong" href={sheetUrl} target="_blank" rel="noopener noreferrer">{t.account.openSheet}</a>
        </div>
        {sorted.length > 0 && (
          <div className="table-wrap">
            <table className="data-table data-table--tight" style={{ minWidth: 1060 }}>
              <thead>
                <tr>
                  <th scope="col">{t.account.colTicker}</th>
                  <th scope="col">{t.journal.colReason}</th>
                  <th scope="col">{t.account.colBuyDate}</th>
                  <th scope="col" className="r">{t.account.colBuyPrice}</th>
                  <th scope="col">{t.journal.colSellDate}</th>
                  <th scope="col" className="r">{t.journal.colSellPrice}</th>
                  <th scope="col" className="r">{t.account.colShares}</th>
                  <th scope="col" className="r">{t.journal.colRet}</th>
                  <th scope="col" className="r">{t.journal.colSpy}</th>
                  <th scope="col" className="r">{t.journal.colExcess}</th>
                  <th scope="col" className="r">{t.account.colPnl}</th>
                  <th scope="col" className="r">{t.journal.colHeld}</th>
                  <th scope="col">{t.account.colMemo}</th>
                  <th scope="col" className="r" aria-label={t.account.edit} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((x) => {
                  const r = x.row;
                  return (
                    <tr key={r.row} data-selected={editing !== "new" && editing?.row === r.row}>
                      <td>
                        <span className="tick" style={{ fontSize: 15 }}>{r.input.ticker}</span>
                        {r.input.company && <div className="cell-sub">{r.input.company}</div>}
                      </td>
                      <td className="small">{r.input.reason || "—"}</td>
                      <td className="small nowrap">{fmtDate(r.input.buyDate, lang)}</td>
                      <td className="r num">{usd(r.buyPrice)}</td>
                      <td className="small nowrap">{fmtDate(r.input.sellDate, lang)}</td>
                      <td className="r num">{usd(r.sellPrice)}</td>
                      <td className="r num">{r.shares ?? "—"}</td>
                      <td className={`r num ${tone(x.ret)}`} style={{ fontWeight: 600 }}>{pct(x.ret)}</td>
                      <td className="r num">{pct(x.spy)}</td>
                      <td className={`r num ${tone(x.excess)}`}>{x.excess != null ? pp(x.excess, 0) : "—"}</td>
                      <td className={`r num ${tone(x.pnl)}`}>{usd(x.pnl, 0)}</td>
                      <td className="r num">{x.days != null ? t.journal.days(x.days) : "—"}</td>
                      <td className="small" style={{ maxWidth: 220 }}>{r.input.memo}</td>
                      <td className="r">
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button type="button" className="btn btn--small" onClick={() => open(r)} aria-label={`${t.account.edit} ${r.input.ticker}`}>
                            {t.account.edit}
                          </button>
                          <DeleteTrade row={r} action={delAction} pending={delPending} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <div id="journal-editor" style={{ scrollMarginTop: 80 }}>
          <JournalForm key={editing === "new" ? "new" : editing.row} row={editing === "new" ? null : editing}
            onDone={finish} onCancel={() => setEditing(null)} />
        </div>
      )}
    </>
  );
}
