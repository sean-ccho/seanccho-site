"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useT } from "./LangProvider";
import { RiskPanel, type StockHint } from "./RiskPanel";
import { SizingCalc, type SizingPrefill } from "./SizingCalc";
import { deleteRowAction, saveRow, sellAction, type ActionState } from "@/app/quant/account/actions";
import type { AccountRow } from "@/lib/account";
import { spyReturn } from "@/lib/bench";
import { fmtDate, pct, pp, stockHref, tone, usd } from "@/lib/format";
import { sector } from "@/lib/i18n";
import type { Benchmark } from "@/lib/types";

type Notice = { ok: boolean; message: string } | null;
type Editing = { kind: "new"; prefill?: SizingPrefill } | { kind: "edit"; row: AccountRow } | { kind: "sell"; row: AccountRow };

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

function Field({ name, label, wide = false, children }: { name: string; label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`field${wide ? " field--wide" : ""}`} htmlFor={`f-${name}`}>
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

/** 추가·수정 폼 — 저장하면 서버 액션이 시트에 쓰고 페이지를 다시 읽는다. */
function AccountForm({ row, prefill, onDone, onCancel }: {
  row: AccountRow | null; prefill?: SizingPrefill; onDone: (n: Notice) => void; onCancel: () => void;
}) {
  const { t } = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRow, null);
  useEffect(() => {
    if (state?.ok) onDone({ ok: true, message: state.message });
  }, [state, onDone]);
  const v = row?.input;
  const opt = (label: string) => `${label} (${t.account.optional})`;
  return (
    <form action={action} className="card account-form" aria-label={row ? `${t.account.edit} ${row.input.ticker}` : t.account.add}>
      <h2 style={{ fontSize: 17 }}>{row ? `${t.account.edit} · ${row.input.ticker}` : t.account.add}</h2>
      {row && <input type="hidden" name="row" value={row.row} />}
      {row && <input type="hidden" name="expect" value={row.input.ticker} />}
      <div className="account-form__grid">
        <Field name="ticker" label={t.account.colTicker}>
          <input id="f-ticker" name="ticker" className="input" required defaultValue={v?.ticker ?? prefill?.ticker}
            autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="AAPL" />
        </Field>
        <Field name="company" label={opt(t.account.colCompany)}>
          <input id="f-company" name="company" className="input" defaultValue={v?.company} />
        </Field>
        <Field name="exchange" label={opt(t.account.colExchange)}>
          <input id="f-exchange" name="exchange" className="input" defaultValue={v?.exchange} list="exchanges" autoComplete="off" />
          <datalist id="exchanges">
            {EXCHANGES.map((x) => <option key={x} value={x} />)}
          </datalist>
        </Field>
        <Field name="sector" label={opt(t.account.colSector)}>
          <input id="f-sector" name="sector" className="input" defaultValue={v?.sector} />
        </Field>
        <Field name="buyPrice" label={t.account.colBuyPrice}>
          <input id="f-buyPrice" name="buyPrice" className="input" inputMode="decimal" defaultValue={v?.buyPrice ?? prefill?.buyPrice} placeholder="0.00" />
        </Field>
        <Field name="shares" label={t.account.colShares}>
          <input id="f-shares" name="shares" className="input" inputMode="decimal" defaultValue={v?.shares ?? prefill?.shares} placeholder="0" />
        </Field>
        <Field name="buyDate" label={t.account.colBuyDate}>
          <input id="f-buyDate" name="buyDate" className="input" type="date" defaultValue={v?.buyDate} />
        </Field>
        <Field name="stop" label={opt(t.account.colStop)}>
          <input id="f-stop" name="stop" className="input" inputMode="decimal" defaultValue={v?.stop ?? prefill?.stop}
            placeholder="0.00" aria-describedby="f-stop-hint" />
          <span id="f-stop-hint" className="tiny muted">{t.account.stopHint}</span>
        </Field>
        <Field name="reason" label={opt(t.account.colReason)}>
          <input id="f-reason" name="reason" className="input" defaultValue={v?.reason} list="reasons" autoComplete="off"
            aria-describedby="f-reason-hint" />
          <datalist id="reasons">
            {t.account.reasonList.map((x) => <option key={x} value={x} />)}
          </datalist>
          <span id="f-reason-hint" className="tiny muted">{t.account.reasonHint}</span>
        </Field>
        <Field name="memo" label={opt(t.account.colMemo)} wide>
          <input id="f-memo" name="memo" className="input" defaultValue={v?.memo} />
        </Field>
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

/** 매도 폼 — 매매일지에 한 줄 붙이고 내계좌 수량을 줄인다. */
function SellForm({ row, today, onDone, onCancel }: { row: AccountRow; today: string; onDone: (n: Notice) => void; onCancel: () => void }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(sellAction, null);
  useEffect(() => {
    if (state?.ok) onDone({ ok: true, message: state.message });
  }, [state, onDone]);
  return (
    <form action={action} className="card account-form" aria-label={t.account.sellTitle(row.input.ticker)}>
      <h2 style={{ fontSize: 17 }}>{t.account.sellTitle(row.input.ticker)}</h2>
      <p className="small muted" style={{ margin: 0 }}>{t.account.sellHelp}</p>
      <input type="hidden" name="row" value={row.row} />
      <input type="hidden" name="expect" value={row.input.ticker} />
      <div className="account-form__grid">
        <Field name="sellDate" label={t.journal.colSellDate}>
          <input id="f-sellDate" name="sellDate" className="input" type="date" required defaultValue={today} />
        </Field>
        <Field name="sellPrice" label={t.journal.colSellPrice}>
          <input id="f-sellPrice" name="sellPrice" className="input" inputMode="decimal" required
            defaultValue={row.price != null ? String(row.price) : ""} placeholder="0.00" />
        </Field>
        <Field name="sellShares" label={t.account.sellShares}>
          <input id="f-sellShares" name="sellShares" className="input" inputMode="decimal" required
            defaultValue={row.shares != null ? String(row.shares) : ""} />
        </Field>
      </div>
      {state && !state.ok && (
        <p role="alert" className="form-msg form-msg--bad">
          {state.message}
        </p>
      )}
      <div className="account-form__actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? t.account.saving : t.account.sell}
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

/** 내계좌 표 + 합계 + 리스크 점검 + 포지션 크기 계산기 + 추가·수정·매도·삭제. */
export function AccountView({ rows, known, sheetUrl, bench, hints, today }: {
  rows: AccountRow[];
  known: string[];
  sheetUrl: string;
  bench: Benchmark | null;
  hints: Record<string, StockHint>;
  today: string;
}) {
  const { lang, t } = useT();
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
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

  const open = (e: Editing) => {
    setNotice(null);
    setEditing(e);
    requestAnimationFrame(() => document.getElementById("account-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // 계산기·리스크 종목 정보 — 대시보드 값(후보·차트 종목) 위에 보유 종목의 시트 값을 덮는다
  const stockHints: Record<string, StockHint> = { ...hints };
  for (const r of rows) {
    const h = stockHints[r.input.ticker];
    stockHints[r.input.ticker] = {
      sector: r.input.sector || h?.sector || null,
      earnings: r.earnings || h?.earnings || null,
      atr: r.atrPct ?? h?.atr ?? null,
      price: r.price ?? h?.price ?? null,
    };
  }

  // 합계는 USD 이고 현재가·매수가·수량이 다 있는 종목만 (새로 넣은 종목은 밤 파이프라인이 현재가를 채운 뒤부터)
  const usdRows = rows.filter((r) => !isCad(r));
  const complete = usdRows.map(calc).filter((c) => c.value != null && c.cost != null && c.pnl != null);
  const sum = (k: "value" | "cost" | "pnl") => complete.reduce((s, c) => s + (c[k] ?? 0), 0);
  const totalCost = sum("cost");
  const totalPnl = sum("pnl");
  const updated = rows.map((r) => r.updated).filter(Boolean).sort().at(-1);
  const selected = editing && editing.kind !== "new" ? editing.row.row : null;

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
          <button type="button" className="btn btn--primary" onClick={() => open({ kind: "new" })}>
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
            <table className="data-table data-table--tight" style={{ minWidth: 1080 }}>
              <thead>
                <tr>
                  <th scope="col">{t.account.colTicker}</th>
                  <th scope="col" className="r">{t.account.colBuyPrice} · {t.account.colBuyDate}</th>
                  <th scope="col" className="r">{t.account.colShares}</th>
                  <th scope="col" className="r">{t.account.colPrice}</th>
                  <th scope="col" className="r">{t.account.colReturn}</th>
                  <th scope="col" className="r" title={t.account.vsSpyNote}>{t.account.colVsSpy}</th>
                  <th scope="col" className="r">{t.account.colValue}</th>
                  <th scope="col" className="r">{t.account.colPnl}</th>
                  <th scope="col" className="r">{t.account.colStop}</th>
                  <th scope="col" className="r">{t.account.colRsi}</th>
                  <th scope="col">{t.account.colReason} · {t.account.colMemo}</th>
                  <th scope="col" className="r" aria-label={t.account.edit} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const c = calc(r);
                  const cad = isCad(r);
                  const rsi = Number(r.rsiDaily);
                  const spy = !cad && r.input.buyDate ? spyReturn(bench, r.input.buyDate) : null;
                  const stopGap = r.stop && r.price ? r.price / r.stop - 1 : null;
                  return (
                    <tr key={r.row} data-selected={selected === r.row}>
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
                      <td className="r num">
                        {money(r.buyPrice, cad)}
                        <div className="cell-sub">{r.input.buyDate ? fmtDate(r.input.buyDate, lang) : "—"}</div>
                      </td>
                      <td className="r num">{r.shares ?? "—"}</td>
                      <td className="r num" style={{ fontWeight: 600 }}>{money(r.price, cad)}</td>
                      <td className={`r num ${tone(c.ret)}`} style={{ fontWeight: 600 }}>{pct(c.ret)}</td>
                      <td className={`r num ${tone(c.ret != null && spy != null ? c.ret - spy : null)}`}
                        title={spy != null ? `SPY ${pct(spy)}` : undefined}>
                        {pp(c.ret, spy)}
                      </td>
                      <td className="r num">{money(c.value, cad, 0)}</td>
                      <td className={`r num ${tone(c.pnl)}`}>{money(c.pnl, cad, 0)}</td>
                      <td className="r num">
                        {r.stop ? money(r.stop, cad) : "—"}
                        {stopGap != null && (
                          <div className="cell-sub" style={{ color: stopGap <= 0.03 ? "var(--warn)" : undefined }}>{pct(stopGap)}</div>
                        )}
                      </td>
                      <td className="r num" style={{ color: rsi >= 70 ? "var(--warn)" : undefined }}>{r.rsiDaily || "—"}</td>
                      <td className="small" style={{ maxWidth: 220 }}>
                        {r.input.reason && <span className="badge badge--mid" style={{ marginRight: 6 }}>{r.input.reason}</span>}
                        {r.input.memo || ""}
                      </td>
                      <td className="r">
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button type="button" className="btn btn--small" onClick={() => open({ kind: "edit", row: r })}
                            aria-label={`${t.account.edit} ${r.input.ticker}`}>
                            {t.account.edit}
                          </button>
                          <button type="button" className="btn btn--small" onClick={() => open({ kind: "sell", row: r })}
                            aria-label={`${t.account.sell} ${r.input.ticker}`}>
                            {t.account.sell}
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
        <p className="tiny muted" style={{ margin: "10px 0 0" }}>{t.account.priceNote} {t.account.vsSpyNote}.</p>
      </section>

      {editing && (
        <div id="account-editor" style={{ scrollMarginTop: 80 }}>
          {editing.kind === "sell" ? (
            <SellForm key={`sell-${editing.row.row}`} row={editing.row} today={today} onDone={finish} onCancel={() => setEditing(null)} />
          ) : (
            <AccountForm key={editing.kind === "new" ? `new-${editing.prefill?.ticker ?? ""}` : editing.row.row}
              row={editing.kind === "edit" ? editing.row : null} prefill={editing.kind === "new" ? editing.prefill : undefined}
              onDone={finish} onCancel={() => setEditing(null)} />
          )}
        </div>
      )}

      <RiskPanel rows={rows} hints={stockHints} today={today} isCad={isCad} />
      <SizingCalc hints={stockHints} onUse={(p) => open({ kind: "new", prefill: p })} />
    </>
  );
}
