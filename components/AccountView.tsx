"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useT } from "./LangProvider";
import { deleteRowAction, saveRow, type ActionState } from "@/app/quant/account/actions";
import type { AccountRow } from "@/lib/account";
import { fmtDate, pct, stockHref, tone, usd } from "@/lib/format";
import { sector } from "@/lib/i18n";

type Notice = { ok: boolean; message: string } | null;

const EXCHANGES = ["NASDAQ", "NYSE", "AMEX", "TSX", "TSXV", "CSE"];

/** 캐나다 시장 종목은 CAD — 합계에서 USD 와 섞지 않는다. */
function isCad(r: AccountRow): boolean {
  const ex = r.input.exchange.toUpperCase();
  const tk = r.input.ticker.toUpperCase();
  return ["TSX", "TSXV", "CSE"].includes(ex) || /\.(V|TO|CN|NE)$/.test(tk);
}

function money(v: number | null, cad: boolean, digits = 2): string {
  const s = usd(v, digits);
  return cad ? s.replace("$", "C$") : s;
}

function calc(r: AccountRow) {
  const { buyPrice: b, shares: n, price: p } = r;
  return {
    ret: b && p ? p / b - 1 : null,
    value: p != null && n != null ? p * n : null,
    cost: b != null && n != null ? b * n : null,
    pnl: b != null && p != null && n != null ? (p - b) * n : null,
  };
}

/** 추가·수정 폼 — 저장하면 서버 액션이 시트에 쓰고 페이지를 다시 읽는다. */
function AccountForm({ row, onDone, onCancel }: { row: AccountRow | null; onDone: (n: Notice) => void; onCancel: () => void }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRow, null);
  useEffect(() => {
    if (state?.ok) onDone({ ok: true, message: state.message });
  }, [state, onDone]);
  const v = row?.input;
  const field = (name: string, label: string, el: React.ReactNode, wide = false) => (
    <label className={`field${wide ? " field--wide" : ""}`} htmlFor={`f-${name}`}>
      <span className="field__label">{label}</span>
      {el}
    </label>
  );
  return (
    <form action={action} className="card account-form" aria-label={row ? `${t.account.edit} ${row.input.ticker}` : t.account.add}>
      <h2 style={{ fontSize: 17 }}>{row ? `${t.account.edit} · ${row.input.ticker}` : t.account.add}</h2>
      {row && <input type="hidden" name="row" value={row.row} />}
      {row && <input type="hidden" name="expect" value={row.input.ticker} />}
      <div className="account-form__grid">
        {field("ticker", t.account.colTicker,
          <input id="f-ticker" name="ticker" className="input" required defaultValue={v?.ticker} autoCapitalize="characters"
            autoComplete="off" spellCheck={false} placeholder="AAPL" />)}
        {field("company", `${t.account.colCompany} (${t.account.optional})`,
          <input id="f-company" name="company" className="input" defaultValue={v?.company} />)}
        {field("exchange", `${t.account.colExchange} (${t.account.optional})`,
          <>
            <input id="f-exchange" name="exchange" className="input" defaultValue={v?.exchange} list="exchanges" autoComplete="off" />
            <datalist id="exchanges">
              {EXCHANGES.map((x) => <option key={x} value={x} />)}
            </datalist>
          </>)}
        {field("sector", `${t.account.colSector} (${t.account.optional})`,
          <input id="f-sector" name="sector" className="input" defaultValue={v?.sector} />)}
        {field("buyPrice", t.account.colBuyPrice,
          <input id="f-buyPrice" name="buyPrice" className="input" inputMode="decimal" defaultValue={v?.buyPrice} placeholder="0.00" />)}
        {field("shares", t.account.colShares,
          <input id="f-shares" name="shares" className="input" inputMode="decimal" defaultValue={v?.shares} placeholder="0" />)}
        {field("buyDate", t.account.colBuyDate,
          <input id="f-buyDate" name="buyDate" className="input" type="date" defaultValue={v?.buyDate} />)}
        {field("memo", `${t.account.colMemo} (${t.account.optional})`,
          <input id="f-memo" name="memo" className="input" defaultValue={v?.memo} />, true)}
      </div>
      {state && !state.ok && (
        <p role="alert" className="form-msg form-msg--bad">
          {state.message}
        </p>
      )}
      <div className="account-form__actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? t.account.saving : t.account.save}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={pending}>
          {t.account.cancel}
        </button>
      </div>
    </form>
  );
}

/** 줄마다 삭제 폼 — 결과(state)는 부모가 갖는다 (지운 줄은 화면에서 사라져 버리므로). */
function DeleteButton({ row, action, pending }: { row: AccountRow; action: (form: FormData) => void; pending: boolean }) {
  const { t } = useT();
  return (
    <form action={action} onSubmit={(e) => {
      if (!window.confirm(t.account.confirmDel(row.input.ticker))) e.preventDefault();
    }}>
      <input type="hidden" name="row" value={row.row} />
      <input type="hidden" name="expect" value={row.input.ticker} />
      <button type="submit" className="btn btn--small btn--danger" disabled={pending}
        aria-label={`${t.account.del} ${row.input.ticker}`}>
        {t.account.del}
      </button>
    </form>
  );
}

/** 내계좌 표 + 합계 + 추가·수정·삭제. */
export function AccountView({ rows, known, sheetUrl }: { rows: AccountRow[]; known: string[]; sheetUrl: string }) {
  const { lang, t } = useT();
  const router = useRouter();
  const [editing, setEditing] = useState<AccountRow | "new" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [refreshing, startRefresh] = useTransition();
  const [delState, delAction, delPending] = useActionState<ActionState, FormData>(deleteRowAction, null);
  const knownSet = new Set(known);

  useEffect(() => {
    if (delState) setNotice({ ok: delState.ok, message: delState.message });
  }, [delState]);

  // 언어를 바꾸면 이전 언어로 된 알림은 지운다
  useEffect(() => setNotice(null), [lang]);

  const finish = useCallback((n: Notice) => {
    setNotice(n);
    if (n?.ok) setEditing(null);
  }, []);

  // 합계는 USD 이고 현재가·매수가·수량이 다 있는 종목만 (새로 넣은 종목은 밤 파이프라인이 현재가를 채운 뒤부터)
  const usdRows = rows.filter((r) => !isCad(r));
  const complete = usdRows.map(calc).filter((c) => c.value != null && c.cost != null && c.pnl != null);
  const sum = (k: "value" | "cost" | "pnl") => complete.reduce((s, c) => s + (c[k] ?? 0), 0);
  const totalCost = sum("cost");
  const totalPnl = sum("pnl");
  const updated = rows.map((r) => r.updated).filter(Boolean).sort().at(-1);

  return (
    <>
      <section className="tiles" aria-label={t.today.summary}>
        <div className="card tile">
          <div className="tile__label">{t.account.totalValue}</div>
          <div className="tile__value">{usd(sum("value"), 0)}</div>
          <div className="tile__sub">{t.account.totalCost} {usd(totalCost, 0)}</div>
        </div>
        <div className="card tile">
          <div className="tile__label">{t.account.totalPnl}</div>
          <div className={`tile__value ${tone(totalPnl)}`}>{usd(totalPnl, 0)}</div>
          <div className="tile__sub">
            <span className={tone(totalPnl)}>{totalCost ? pct(totalPnl / totalCost) : "—"}</span>
          </div>
        </div>
      </section>
      {usdRows.length !== rows.length && <p className="small muted" style={{ margin: "-8px 0 0" }}>{t.account.mixedCcy}</p>}

      {notice && (
        <p role="status" className={`form-msg ${notice.ok ? "form-msg--good" : "form-msg--bad"}`}>
          {notice.message}
        </p>
      )}

      <section className="card" aria-labelledby="acct-title">
        <div className="section-head">
          <h2 id="acct-title">{t.today.holdings}</h2>
          <p>{updated ? t.account.updated(updated) : t.account.priceNote}</p>
        </div>
        <div className="account-toolbar">
          <button type="button" className="btn btn--primary" onClick={() => { setNotice(null); setEditing("new"); }}>
            + {t.account.add}
          </button>
          <button type="button" className="btn" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
            {t.account.refresh}
          </button>
          <a className="link-strong" href={sheetUrl} target="_blank" rel="noopener noreferrer">
            {t.account.openSheet}
          </a>
        </div>

        {rows.length === 0 ? (
          <p className="muted" style={{ margin: "12px 0 0" }}>{t.account.empty}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table" style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th scope="col">{t.account.colTicker}</th>
                  <th scope="col" className="r">{t.account.colBuyPrice}</th>
                  <th scope="col" className="r">{t.account.colShares}</th>
                  <th scope="col">{t.account.colBuyDate}</th>
                  <th scope="col" className="r">{t.account.colPrice}</th>
                  <th scope="col" className="r">{t.account.colReturn}</th>
                  <th scope="col" className="r">{t.account.colValue}</th>
                  <th scope="col" className="r">{t.account.colPnl}</th>
                  <th scope="col" className="r">{t.account.colRsi}</th>
                  <th scope="col">{t.account.colMemo}</th>
                  <th scope="col" className="r" aria-label={t.account.edit} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const c = calc(r);
                  const cad = isCad(r);
                  const rsi = Number(r.rsiDaily);
                  return (
                    <tr key={r.row} data-selected={editing !== "new" && editing?.row === r.row}>
                      <td>
                        {knownSet.has(r.input.ticker) ? (
                          <Link className="tick" style={{ fontSize: 15 }} href={stockHref(r.input.ticker)}>
                            {r.input.ticker}
                          </Link>
                        ) : (
                          <span className="tick" style={{ fontSize: 15 }}>{r.input.ticker}</span>
                        )}
                        <div className="cell-sub">
                          {[r.input.company, r.input.exchange, sector(lang, r.input.sector)].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="r num">{money(r.buyPrice, cad)}</td>
                      <td className="r num">{r.shares ?? "—"}</td>
                      <td className="small">{r.input.buyDate ? fmtDate(r.input.buyDate, lang) : "—"}</td>
                      <td className="r num" style={{ fontWeight: 600 }}>{money(r.price, cad)}</td>
                      <td className={`r num ${tone(c.ret)}`} style={{ fontWeight: 600 }}>{pct(c.ret)}</td>
                      <td className="r num">{money(c.value, cad, 0)}</td>
                      <td className={`r num ${tone(c.pnl)}`}>{money(c.pnl, cad, 0)}</td>
                      <td className="r num" style={{ color: rsi >= 70 ? "var(--warn)" : undefined }}>{r.rsiDaily || "—"}</td>
                      <td className="small" style={{ maxWidth: 220 }}>{r.input.memo || ""}</td>
                      <td className="r">
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button type="button" className="btn btn--small" onClick={() => { setNotice(null); setEditing(r); }}
                            aria-label={`${t.account.edit} ${r.input.ticker}`}>
                            {t.account.edit}
                          </button>
                          <DeleteButton row={r} action={delAction} pending={delPending} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="tiny muted" style={{ margin: "10px 0 0" }}>{t.account.priceNote}</p>
      </section>

      {editing && (
        <AccountForm key={editing === "new" ? "new" : editing.row} row={editing === "new" ? null : editing}
          onDone={finish} onCancel={() => setEditing(null)} />
      )}
    </>
  );
}
