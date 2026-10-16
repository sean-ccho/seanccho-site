"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useT } from "./LangProvider";
import { deleteWatch, saveWatch } from "@/app/quant/watchlist/actions";
import type { ActionState } from "@/lib/actionUtils";
import { fmtDate, pct, stockHref, usd } from "@/lib/format";
import type { WatchRow } from "@/lib/watchlist";

type Notice = { ok: boolean; message: string } | null;

function WatchForm({ row, onDone, onCancel }: { row: WatchRow | null; onDone: (n: Notice) => void; onCancel: () => void }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveWatch, null);
  useEffect(() => {
    if (state?.ok) onDone({ ok: true, message: state.message });
  }, [state, onDone]);
  const v = row?.input;
  return (
    <form action={action} className="card account-form" aria-label={row ? `${t.account.edit} ${row.input.ticker}` : t.watch.add}>
      <h2 style={{ fontSize: 17 }}>{row ? `${t.account.edit} · ${row.input.ticker}` : t.watch.add}</h2>
      {row && <input type="hidden" name="row" value={row.row} />}
      {row && <input type="hidden" name="expect" value={row.input.ticker} />}
      {row && <input type="hidden" name="added" value={row.input.added} />}
      <div className="account-form__grid">
        <label className="field" htmlFor="w-ticker">
          <span className="field__label">{t.account.colTicker}</span>
          <input id="w-ticker" name="ticker" className="input" required defaultValue={v?.ticker}
            autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="AAPL" />
        </label>
        <label className="field" htmlFor="w-target">
          <span className="field__label">{t.watch.colTarget} ({t.account.optional})</span>
          <input id="w-target" name="target" className="input" inputMode="decimal" defaultValue={v?.target} placeholder="0.00" />
        </label>
        <label className="field" htmlFor="w-cond">
          <span className="field__label">{t.watch.colCond}</span>
          <select id="w-cond" name="cond" className="input" defaultValue={v?.cond === "이상" ? "이상" : "이하"}>
            <option value="이하">{t.watch.condBelow}</option>
            <option value="이상">{t.watch.condAbove}</option>
          </select>
        </label>
        <label className="field field--wide" htmlFor="w-memo">
          <span className="field__label">{t.watch.colMemo} ({t.account.optional})</span>
          <input id="w-memo" name="memo" className="input" defaultValue={v?.memo} />
        </label>
      </div>
      {state && !state.ok && <p role="alert" className="form-msg form-msg--bad">{state.message}</p>}
      <div className="account-form__actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? t.account.saving : t.account.save}</button>
        <button type="button" className="btn" onClick={onCancel} disabled={pending}>{t.account.cancel}</button>
      </div>
    </form>
  );
}

function DeleteWatch({ row, action, pending }: { row: WatchRow; action: (f: FormData) => void; pending: boolean }) {
  const { t } = useT();
  return (
    <form action={action} onSubmit={(e) => {
      if (!window.confirm(t.watch.confirmDel(row.input.ticker))) e.preventDefault();
    }}>
      <input type="hidden" name="row" value={row.row} />
      <input type="hidden" name="expect" value={row.input.ticker} />
      <button type="submit" className="btn btn--small btn--danger" disabled={pending} aria-label={`${t.account.del} ${row.input.ticker}`}>
        {t.account.del}
      </button>
    </form>
  );
}

/** 관심종목 — 목표가·조건·이유. 현재가·도달은 밤 파이프라인 값, 없으면 대시보드 가격을 쓴다. */
export function WatchlistView({ rows, known, prices, sheetUrl }: {
  rows: WatchRow[];
  known: string[];
  prices: Record<string, number>;
  sheetUrl: string;
}) {
  const { lang, t } = useT();
  const router = useRouter();
  const [editing, setEditing] = useState<WatchRow | "new" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [refreshing, startRefresh] = useTransition();
  const [delState, delAction, delPending] = useActionState<ActionState, FormData>(deleteWatch, null);
  const knownSet = new Set(known);

  useEffect(() => {
    if (delState) setNotice({ ok: delState.ok, message: delState.message });
  }, [delState]);
  useEffect(() => setNotice(null), [lang]);
  const finish = useCallback((n: Notice) => {
    setNotice(n);
    if (n?.ok) setEditing(null);
  }, []);
  const open = (e: WatchRow | "new") => {
    setNotice(null);
    setEditing(e);
    requestAnimationFrame(() => document.getElementById("watch-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      {notice && <p role="status" className={`form-msg ${notice.ok ? "form-msg--good" : "form-msg--bad"}`}>{notice.message}</p>}
      <section className="card" aria-labelledby="watch-title">
        <div className="section-head">
          <h2 id="watch-title">{t.watch.title}</h2>
          <p>{t.watch.note}</p>
        </div>
        <div className="account-toolbar">
          <button type="button" className="btn btn--primary" onClick={() => open("new")}>+ {t.watch.add}</button>
          <button type="button" className="btn" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
            {t.account.refresh}
          </button>
          <a className="link-strong" href={sheetUrl} target="_blank" rel="noopener noreferrer">{t.account.openSheet}</a>
        </div>
        {rows.length === 0 ? (
          <p className="muted" style={{ margin: "12px 0 0" }}>{t.watch.empty}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th scope="col">{t.account.colTicker}</th>
                  <th scope="col" className="r">{t.watch.colTarget}</th>
                  <th scope="col">{t.watch.colCond}</th>
                  <th scope="col" className="r">{t.watch.colPrice}</th>
                  <th scope="col" className="r">{t.watch.colDist}</th>
                  <th scope="col">{t.watch.colHit}</th>
                  <th scope="col">{t.watch.colMemo}</th>
                  <th scope="col">{t.watch.colAdded}</th>
                  <th scope="col" className="r" aria-label={t.account.edit} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const price = r.price ?? prices[r.input.ticker] ?? null;
                  const dist = r.target && price ? r.target / price - 1 : null;
                  const hit = r.target != null && price != null && (r.above ? price >= r.target : price <= r.target);
                  return (
                    <tr key={r.row} data-selected={editing !== "new" && editing?.row === r.row}>
                      <td>
                        {knownSet.has(r.input.ticker) ? (
                          <Link className="tick" style={{ fontSize: 15 }} href={stockHref(r.input.ticker)}>{r.input.ticker}</Link>
                        ) : (
                          <span className="tick" style={{ fontSize: 15 }}>{r.input.ticker}</span>
                        )}
                      </td>
                      <td className="r num">{usd(r.target)}</td>
                      <td className="small">{r.target != null ? (r.above ? t.watch.condAbove : t.watch.condBelow) : "—"}</td>
                      <td className="r num" style={{ fontWeight: 600 }}>{usd(price)}</td>
                      <td className="r num">{pct(dist)}</td>
                      <td>{hit || r.hit ? <span className="badge badge--good">{t.watch.hit}</span> : ""}</td>
                      <td className="small" style={{ maxWidth: 280 }}>{r.input.memo}</td>
                      <td className="small">{r.input.added ? fmtDate(r.input.added, lang) : "—"}</td>
                      <td className="r">
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button type="button" className="btn btn--small" onClick={() => open(r)} aria-label={`${t.account.edit} ${r.input.ticker}`}>
                            {t.account.edit}
                          </button>
                          <DeleteWatch row={r} action={delAction} pending={delPending} />
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
        <div id="watch-editor" style={{ scrollMarginTop: 80 }}>
          <WatchForm key={editing === "new" ? "new" : editing.row} row={editing === "new" ? null : editing}
            onDone={finish} onCancel={() => setEditing(null)} />
        </div>
      )}
    </>
  );
}
