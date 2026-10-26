"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useT } from "./LangProvider";
import { TickerLink } from "./TickerLink";
import { ReasonStats } from "./ReasonStats";
import { RiskPanel, type StockHint } from "./RiskPanel";
import { SizingCalc, type SizingPrefill } from "./SizingCalc";
import { SqzBadge } from "./StockChips";
import { deleteRowAction, saveRow, sellAction, type ActionState } from "@/app/quant/account/actions";
import type { AccountRow } from "@/lib/account";
import { spyReturn } from "@/lib/bench";
import { calcTrade, summarize } from "@/lib/journalStats";
import { fmtDate, isCadListing, pct, pp, tone, usd } from "@/lib/format";
import { keepForm } from "@/lib/keepForm";
import { sector } from "@/lib/i18n";
import type { Benchmark, SqzInfo } from "@/lib/types";

type Notice = { ok: boolean; message: string } | null;
type Editing = { kind: "new"; prefill?: SizingPrefill } | { kind: "edit"; row: AccountRow } | { kind: "sell"; row: AccountRow };
type Filter = "all" | "open" | "closed";

const EXCHANGES = ["NASDAQ", "NYSE", "AMEX", "TSX", "TSXV", "CSE"];

/** 캐나다 시장 종목은 CAD — 합계에서 USD 와 섞지 않는다. */
function isCad(r: AccountRow): boolean {
  return isCadListing(r.input.ticker, r.input.exchange);
}

function money(v: number | null, cad: boolean, digits = 2): string {
  const s = usd(v, digits);
  return cad ? s.replace("$", "C$") : s;
}

/** 보유 중이면 현재가, 매도 완료면 매도가 기준. */
function calc(r: AccountRow) {
  const { buyPrice: b, shares: n } = r;
  const p = r.closed ? r.sellPrice : r.price;
  return {
    ret: b && p ? p / b - 1 : null,
    value: p != null && n != null ? p * n : null,
    cost: b != null && n != null ? b * n : null,
    pnl: b != null && p != null && n != null ? (p - b) * n : null,
  };
}

function daysBetween(a: string, b: string): number | null {
  if (!a || !b) return null;
  const d = (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(d) ? d : null;
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
    <form onSubmit={keepForm(action)} className="card account-form" aria-label={row ? `${t.account.edit} ${row.input.ticker}` : t.account.add}>
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
        <Field name="target" label={opt(t.account.colTarget)}>
          <input id="f-target" name="target" className="input" inputMode="decimal" defaultValue={v?.target}
            placeholder="0.00" aria-describedby="f-target-hint" />
          <span id="f-target-hint" className="tiny muted">{t.account.targetHint}</span>
        </Field>
        <Field name="reason" label={opt(t.account.colReason)}>
          <input id="f-reason" name="reason" className="input" defaultValue={v?.reason} list="reasons" autoComplete="off"
            aria-describedby="f-reason-hint" />
          <datalist id="reasons">
            {t.account.reasonList.map((x) => <option key={x} value={x} />)}
          </datalist>
          <span id="f-reason-hint" className="tiny muted">{t.account.reasonHint}</span>
        </Field>
        <Field name="sellDate" label={opt(t.journal.colSellDate)}>
          <input id="f-sellDate" name="sellDate" className="input" type="date" defaultValue={v?.sellDate}
            aria-describedby="f-sell-hint" />
          <span id="f-sell-hint" className="tiny muted">{t.account.sellFieldsHint}</span>
        </Field>
        <Field name="sellPrice" label={opt(t.journal.colSellPrice)}>
          <input id="f-sellPrice" name="sellPrice" className="input" inputMode="decimal" defaultValue={v?.sellPrice} placeholder="0.00" />
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

/** 매도 폼 — 같은 줄을 매도 완료로 (일부만 팔면 판 수량은 새 줄로). */
function SellForm({ row, today, onDone, onCancel }: { row: AccountRow; today: string; onDone: (n: Notice) => void; onCancel: () => void }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(sellAction, null);
  useEffect(() => {
    if (state?.ok) onDone({ ok: true, message: state.message });
  }, [state, onDone]);
  return (
    <form onSubmit={keepForm(action)} className="card account-form" aria-label={t.account.sellTitle(row.input.ticker)}>
      <h2 style={{ fontSize: 17 }}>{t.account.sellTitle(row.input.ticker)}</h2>
      <p className="small muted" style={{ margin: 0 }}>{t.account.sellHelp}</p>
      <input type="hidden" name="row" value={row.row} />
      <input type="hidden" name="expect" value={row.input.ticker} />
      <div className="account-form__grid">
        <Field name="s-sellDate" label={t.journal.colSellDate}>
          <input id="f-s-sellDate" name="sellDate" className="input" type="date" required defaultValue={today} />
        </Field>
        <Field name="s-sellPrice" label={t.journal.colSellPrice}>
          <input id="f-s-sellPrice" name="sellPrice" className="input" inputMode="decimal" required
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

/**
 * 내계좌 — 한 줄 = 거래 하나 (보유 중 · 매도 완료). 표 + 합계(보유·실현) + 매수이유별 성적 + 리스크 점검 + 포지션 크기 계산기.
 * 리스크·계산기·보유 합계는 보유 중인 줄만, 매수이유별 성적·실현 손익은 매도 완료 줄만 쓴다. 샘플 줄은 어디에도 안 센다.
 */
export function AccountView({ rows, sheetUrl, bench, hints, sqz, today }: {
  rows: AccountRow[];
  sheetUrl: string;
  bench: Benchmark | null;
  hints: Record<string, StockHint>;
  sqz: Record<string, SqzInfo>; // 보유 종목 SQZ 모멘텀 (티커 대문자 → 일·주·월) — 표시 전용
  today: string;
}) {
  const { lang, t } = useT();
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState<Notice>(null);
  const [refreshing, startRefresh] = useTransition();
  const [delState, delAction, delPending] = useActionState<ActionState, FormData>(deleteRowAction, null);

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

  // 샘플 줄(메모가 '샘플'로 시작)은 표 맨 아래에 보이기만 — 합계·리스크·계산기·매수이유 성적에는 안 들어간다
  const sampleRows = rows.filter((r) => r.sample);
  const openRows = rows.filter((r) => !r.closed && !r.sample);
  // 매도 완료는 최근에 판 것부터
  const closedRows = rows.filter((r) => r.closed && !r.sample)
    .sort((a, b) => b.input.sellDate.localeCompare(a.input.sellDate) || b.row - a.row);

  // 계산기·리스크 종목 정보 — 대시보드 값(후보·차트 종목) 위에 보유 종목의 시트 값을 덮는다
  const stockHints: Record<string, StockHint> = { ...hints };
  for (const r of openRows) {
    const h = stockHints[r.input.ticker];
    stockHints[r.input.ticker] = {
      sector: r.input.sector || h?.sector || null,
      earnings: r.earnings || h?.earnings || null,
      atr: r.atrPct ?? h?.atr ?? null,
      price: r.price ?? h?.price ?? null,
    };
  }

  // 합계는 가격·매수가·수량이 다 있는 줄만 — USD 와 CAD 는 따로 (환율을 모르니 섞지 않는다).
  // 시트 현재가가 아직 없는 줄은 페이지가 사이트 종가로 채워 오고, 그것도 없으면 missing 으로 센다
  const total = (list: AccountRow[]) => {
    const c = list.map(calc).filter((x) => x.value != null && x.cost != null && x.pnl != null);
    const sum = (k: "value" | "cost" | "pnl") => c.reduce((s, x) => s + (x[k] ?? 0), 0);
    return { value: sum("value"), cost: sum("cost"), pnl: sum("pnl"), n: c.length, missing: list.length - c.length,
      wins: c.filter((x) => (x.pnl ?? 0) > 0).length };
  };
  const held = total(openRows.filter((r) => !isCad(r)));
  const heldCad = total(openRows.filter(isCad));
  const realized = total(closedRows.filter((r) => !isCad(r)));
  const mixed = rows.some((r) => !r.sample && isCad(r));

  // 매수이유별 성적 — 매도 완료 줄 (CAD 종목은 SPY 비교가 맞지 않아 뺀다)
  const reasons = useMemo(
    () => summarize(rows.filter((r) => r.closed && !r.sample && !isCad(r)).map((r) => calcTrade(r, bench))),
    [rows, bench],
  );

  const shown = filter === "open" ? openRows : filter === "closed" ? closedRows : [...openRows, ...closedRows, ...sampleRows];
  const updated = openRows.map((r) => r.updated).filter(Boolean).sort().at(-1);
  const selected = editing && editing.kind !== "new" ? editing.row.row : null;
  const filters: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: t.account.filterAll, n: rows.length },
    { key: "open", label: t.account.statusOpen, n: openRows.length },
    { key: "closed", label: t.account.statusClosed, n: closedRows.length },
  ];

  return (
    <>
      <section className="tiles" aria-label={t.today.summary}>
        <div className="card tile">
          <div className="tile__label">{t.account.totalValue}</div>
          <div className="tile__value">{held.n ? usd(held.value, 0) : "—"}</div>
          <div className="tile__sub">{t.account.totalCost} {held.n ? usd(held.cost, 0) : "—"}</div>
          {held.missing > 0 && <div className="tile__sub" style={{ color: "var(--warn)" }}>{t.account.missingPrice(held.missing)}</div>}
          {heldCad.n > 0 && (
            <div className="tile__sub">{t.account.cadLine(money(heldCad.value, true, 0), money(heldCad.cost, true, 0))}</div>
          )}
        </div>
        <div className="card tile">
          <div className="tile__label">{t.account.totalPnl}</div>
          <div className={`tile__value ${tone(held.n ? held.pnl : null)}`}>{held.n ? usd(held.pnl, 0) : "—"}</div>
          <div className="tile__sub">
            <span className={tone(held.pnl)}>{held.cost ? pct(held.pnl / held.cost) : "—"}</span>
          </div>
          {heldCad.n > 0 && (
            <div className="tile__sub">
              <span className={tone(heldCad.pnl)}>{money(heldCad.pnl, true, 0)} ({heldCad.cost ? pct(heldCad.pnl / heldCad.cost) : "—"})</span>
            </div>
          )}
        </div>
        <div className="card tile">
          <div className="tile__label">{t.account.realized}</div>
          <div className={`tile__value ${tone(realized.n ? realized.pnl : null)}`}>{realized.n ? usd(realized.pnl, 0) : "—"}</div>
          <div className="tile__sub">
            {t.account.realizedSub(realized.n, realized.n ? pct(realized.wins / realized.n, 0, false) : "—")}
          </div>
        </div>
      </section>
      {mixed && <p className="small muted" style={{ margin: "-8px 0 0" }}>{t.account.mixedCcy}</p>}
      {sampleRows.length > 0 && <p className="small muted" style={{ margin: "-8px 0 0" }}>{t.account.sampleNote(sampleRows.length)}</p>}

      {notice && (
        <p role="status" className={`form-msg ${notice.ok ? "form-msg--good" : "form-msg--bad"}`}>
          {notice.message}
        </p>
      )}

      <section className="card" aria-labelledby="acct-title">
        <div className="section-head">
          <h2 id="acct-title">{t.account.title}</h2>
          <p>{updated ? t.account.updated(updated) : t.account.priceNote}</p>
        </div>
        <div className="account-toolbar">
          <button type="button" className="btn btn--primary" onClick={() => open({ kind: "new" })}>
            + {t.account.add}
          </button>
          <div className="seg" role="group" aria-label={t.account.filterAria}>
            {filters.map((f) => (
              <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label} <span className="num">{f.n}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
            {t.account.refresh}
          </button>
          <a className="link-strong" href={sheetUrl} target="_blank" rel="noopener noreferrer">
            {t.account.openSheet}
          </a>
        </div>

        {rows.length === 0 ? (
          <p className="muted" style={{ margin: "12px 0 0" }}>{t.account.empty}</p>
        ) : shown.length === 0 ? (
          <p className="muted" style={{ margin: "12px 0 0" }}>{t.account.noneInFilter}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--tight" style={{ minWidth: 1180 }}>
              <thead>
                <tr>
                  <th scope="col">{t.account.colTicker}</th>
                  <th scope="col" className="r">{t.account.colBuyPrice} · {t.account.colBuyDate}</th>
                  <th scope="col" className="r">{t.account.colShares}</th>
                  <th scope="col" className="r">{t.account.colPriceSell}</th>
                  <th scope="col" className="r">{t.account.colReturn}</th>
                  <th scope="col" className="r" title={t.account.vsSpyNote}>{t.account.colVsSpy}</th>
                  <th scope="col" className="r">{t.account.colValueSell}</th>
                  <th scope="col" className="r">{t.account.colPnl}</th>
                  <th scope="col" className="r">{t.account.colStop}</th>
                  <th scope="col" className="r" title={t.account.targetHint}>{t.account.colTarget}</th>
                  <th scope="col" className="r">{t.account.colRsi}</th>
                  <th scope="col">{t.account.colReason} · {t.account.colMemo}</th>
                  <th scope="col" className="r" aria-label={t.account.edit} />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const c = calc(r);
                  const cad = isCad(r);
                  const rsi = Number(r.rsiDaily);
                  const spy = !cad && r.input.buyDate ? spyReturn(bench, r.input.buyDate, r.closed ? r.input.sellDate : null) : null;
                  const stopGap = !r.closed && r.stop && r.price ? r.price / r.stop - 1 : null;
                  const targetGap = !r.closed && r.target && r.price ? r.target / r.price - 1 : null;
                  const days = daysBetween(r.input.buyDate, r.closed ? r.input.sellDate : today);
                  return (
                    <tr key={r.row} data-selected={selected === r.row} data-closed={r.closed || undefined}
                      data-sample={r.sample || undefined}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <TickerLink ticker={r.input.ticker} style={{ fontSize: 15 }} />
                          <span className={`badge ${r.closed || r.sample ? "badge--mid" : "badge--held"}`}
                            title={r.sample ? t.account.sampleTitle : undefined}>
                            {r.sample ? t.account.statusSample : r.closed ? t.account.statusClosed : t.account.statusOpen}
                          </span>
                        </div>
                        <div className="cell-sub">
                          {[r.input.company, r.input.exchange, sector(lang, r.input.sector)].filter(Boolean).join(" · ")}
                        </div>
                        {!r.closed && !r.sample && r.secFlags && (
                          <div className="cell-sub" style={{ color: "var(--warn)", fontWeight: 600 }} title={t.sec.title}>
                            {r.secFlags}
                          </div>
                        )}
                        {/* SQZ 모멘텀 일·주·월 — 다른 페이지 배지와 같은 말. 보유 중이라 늘 보인다 (힘 빠짐 2봉째 ⚠ = 팔 때 참고) */}
                        {!r.closed && !r.sample && sqz[r.input.ticker.toUpperCase()] && (
                          <div className="account-sqz">
                            <span className="account-sqz__label" title={t.list.sqzNote}>SQZ</span>
                            <SqzBadge sqz={sqz[r.input.ticker.toUpperCase()]} pick="all" always />
                          </div>
                        )}
                      </td>
                      <td className="r num">
                        {money(r.buyPrice, cad)}
                        <div className="cell-sub">
                          {r.input.buyDate ? fmtDate(r.input.buyDate, lang) : "—"}
                          {days != null && days >= 0 && <span title={t.journal.colHeld}> · {t.journal.days(days)}</span>}
                          {days != null && days < 0 && (
                            <span style={{ color: "var(--warn)" }} title={t.account.futureDateTitle}> · {t.account.futureDate}</span>
                          )}
                        </div>
                      </td>
                      <td className="r num">{r.shares ?? "—"}</td>
                      <td className="r num" style={{ fontWeight: 600 }}>
                        {money(r.closed ? r.sellPrice : r.price, cad)}
                        {r.closed && <div className="cell-sub">{fmtDate(r.input.sellDate, lang)}</div>}
                        {!r.closed && r.priceSite && (
                          <div className="cell-sub" style={{ fontWeight: 400 }} title={t.account.priceSiteTitle}>{t.account.priceSite}</div>
                        )}
                      </td>
                      <td className={`r num ${tone(c.ret)}`} style={{ fontWeight: 600 }}>{pct(c.ret)}</td>
                      <td className={`r num ${tone(c.ret != null && spy != null ? c.ret - spy : null)}`}
                        title={spy != null ? `SPY ${pct(spy)}` : undefined}>
                        {pp(c.ret, spy)}
                      </td>
                      <td className="r num">{money(c.value, cad, 0)}</td>
                      <td className={`r num ${tone(c.pnl)}`}>{money(c.pnl, cad, 0)}</td>
                      <td className="r num">
                        {r.stop && !r.closed ? money(r.stop, cad) : "—"}
                        {stopGap != null && (
                          <div className="cell-sub" style={{ color: stopGap <= 0.03 ? "var(--warn)" : undefined }}>{pct(stopGap)}</div>
                        )}
                      </td>
                      <td className="r num">
                        {r.target && !r.closed ? money(r.target, cad) : "—"}
                        {targetGap != null && (
                          targetGap <= 0
                            ? <div className="cell-sub"><span className="badge badge--good">{t.account.targetHit}</span></div>
                            : <div className="cell-sub" title={t.account.targetGapTitle}>{pct(targetGap)}</div>
                        )}
                      </td>
                      <td className="r num" style={{ color: !r.closed && rsi >= 70 ? "var(--warn)" : undefined }}>
                        {!r.closed && r.rsiDaily ? r.rsiDaily : "—"}
                      </td>
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
                          {!r.closed && !r.sample && (
                            <button type="button" className="btn btn--small" onClick={() => open({ kind: "sell", row: r })}
                              aria-label={`${t.account.sell} ${r.input.ticker}`}>
                              {t.account.sell}
                            </button>
                          )}
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

      <ReasonStats all={reasons.all} byReason={reasons.byReason} hasBench={Boolean(bench?.closes.length)} />
      <RiskPanel rows={openRows} hints={stockHints} today={today} isCad={isCad} />
      <SizingCalc hints={stockHints} onUse={(p) => open({ kind: "new", prefill: p })} />
    </>
  );
}
