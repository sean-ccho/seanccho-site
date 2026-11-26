"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { EarningsPanel, earningsItems } from "./EarningsPanel";
import { Flash } from "./Flash";
import { Icon, type IconName } from "./Icon";
import { useT } from "./LangProvider";
import { LiveDot } from "./LiveMark";
import { ReasonStats } from "./ReasonStats";
import { RiskPanel, type StockHint } from "./RiskPanel";
import { SizingCalc, type SizingPrefill } from "./SizingCalc";
import { SqzMini } from "./StockChips";
import { TickerLink } from "./TickerLink";
import { deleteRowAction, saveRow, sellAction, type ActionState } from "@/app/quant/account/actions";
import type { AccountRow } from "@/lib/account";
import { rowKey } from "@/lib/accountKey";
import { spyReturn } from "@/lib/bench";
import { calcTrade, summarize } from "@/lib/journalStats";
import { fmtDate, isCadListing, pct, pp, splitLabel, tone, usd } from "@/lib/format";
import { keepForm } from "@/lib/keepForm";
import { sector } from "@/lib/i18n";
import { styleTitle } from "@/lib/stockStyle";
import type { Benchmark, SqzInfo, StockStyle } from "@/lib/types";

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

/** 1달러 미만 가격은 소수 넷째 자리까지 (C$0.115 가 C$0.12 로 보이지 않게). */
function priceMoney(v: number | null, cad: boolean): string {
  return money(v, cad, v != null && Math.abs(v) < 1 ? 4 : 2);
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

/** 줄 지우기 폼 id — 수정 폼 안의 '이 줄 삭제' 버튼이 form 속성으로 이 폼을 보낸다 (폼 안에 폼을 넣을 수 없어서). */
const delFormId = (row: AccountRow) => `acct-del-${row.row}`;

/** 추가·수정 폼 — 저장하면 서버 액션이 시트에 쓰고 페이지를 다시 읽는다. 수정일 때는 '이 줄 삭제'도 (2026-11-26 표에서 옮김). */
function AccountForm({ row, prefill, onDone, onCancel, delPending }: {
  row: AccountRow | null; prefill?: SizingPrefill; onDone: (n: Notice) => void; onCancel: () => void; delPending: boolean;
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
      {row && <input type="hidden" name="key" value={rowKey(row)} />}
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
        {row && (
          <button type="submit" form={delFormId(row)} className="btn btn--danger acct-form-del" disabled={pending || delPending}
            aria-label={`${t.account.del} ${row.input.ticker}`}>
            {t.account.delRow}
          </button>
        )}
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
      <input type="hidden" name="key" value={rowKey(row)} />
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

/** 줄 지우기 폼 — 결과(state)는 부모가 갖는다 (지운 줄은 화면에서 사라져 버리므로). button=false 면 버튼 없이 폼만 (수정 폼의 버튼이 보낸다). */
function DeleteForm({ row, action, pending, button = true }: {
  row: AccountRow; action: (form: FormData) => void; pending: boolean; button?: boolean;
}) {
  const { t } = useT();
  return (
    <form id={button ? undefined : delFormId(row)} action={action} onSubmit={(e) => {
      if (!window.confirm(t.account.confirmDel(row.input.ticker))) e.preventDefault();
    }}>
      <input type="hidden" name="row" value={row.row} />
      <input type="hidden" name="expect" value={row.input.ticker} />
      <input type="hidden" name="key" value={rowKey(row)} />
      {button && (
        <button type="submit" className="btn btn--small btn--danger" disabled={pending}
          aria-label={`${t.account.del} ${row.input.ticker}`}>
          {t.account.del}
        </button>
      )}
    </form>
  );
}

/** 위 숫자 칸 하나 — 이름 · 오른쪽 위 그림, 아래는 값 줄 (2026-11-26 사용자 시안). */
function Kpi({ label, icon, iconTone, children }: { label: string; icon: IconName; iconTone?: string; children: ReactNode }) {
  return (
    <div className="card acct-kpi">
      <div className="acct-kpi__head">
        <span>{label}</span>
        <span className={`acct-kpi__icon${iconTone ? ` ${iconTone}` : ""}`}><Icon name={icon} size={17} /></span>
      </div>
      {children}
    </div>
  );
}

/**
 * 내계좌 — 한 줄 = 거래 하나 (보유 중 · 매도 완료). 2026-11-26 사용자 시안으로 개편:
 * 숫자 칸 넷(보유 평가액 · 보유 손익 · 실현 손익 · 다음 2주 실적) → [쏠림 | 리스크 점검 + 매수이유별 성적] → 거래 표 →
 * [보유종목 뉴스 | 포지션 크기 계산기]. 2주 안 실적이 있으면 숫자 칸 아래 실적 카드(대응 정하기)가 붙는다.
 * 리스크·계산기·보유 합계는 보유 중인 줄만, 매수이유별 성적·실현 손익은 매도 완료 줄만 쓴다. 샘플 줄은 어디에도 안 센다.
 */
export function AccountView({ rows, sheetUrl, bench, hints, sqz, styles = {}, today, mix, news, fx, splits = {} }: {
  rows: AccountRow[];
  /** 보유 종목의 최근 90일 액면분할 (티커 → {날짜, 비율}, 사이트 종목 정보 — 2026-11-18) */
  splits?: Record<string, { date: string; ratio: number }>;
  /** 1 US$ = usdcad C$ · 그 날짜 (경제 탭 환율, 2026-11-18) — 합계 환산 · 리스크 패널. 없으면 C$ 는 따로만 */
  fx?: { usdcad: number; date: string } | null;
  sheetUrl: string;
  bench: Benchmark | null;
  hints: Record<string, StockHint>;
  sqz: Record<string, SqzInfo>; // 보유 종목 SQZ 모멘텀 (티커 대문자 → 일·주·월) — 표시 전용
  /** 보유 종목 경기순환/방어 · 내수/글로벌 (티커 대문자 → 사이트 종목 정보, 2026-11-26) — 표의 '순환' · '방어' 배지 */
  styles?: Record<string, StockStyle>;
  today: string;
  mix?: ReactNode; // 내 계좌 쏠림 카드 — 서버가 계산해서 넘긴다 (리스크 점검 왼쪽)
  news?: ReactNode; // 보유종목 뉴스 칸 — 서버가 그려서 넘긴다 (계산기 왼쪽)
}) {
  const { lang, t } = useT();
  const A = t.account;
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState<Notice>(null);
  const [refreshing, startRefresh] = useTransition();
  const [delState, delAction, delPending] = useActionState<ActionState, FormData>(deleteRowAction, null);

  useEffect(() => {
    if (delState) setNotice({ ok: delState.ok, message: delState.message });
    if (delState?.ok) setEditing(null);
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
      move: h?.move ?? null,
      cycle: h?.cycle ?? styles[r.input.ticker.toUpperCase()]?.cycle ?? null,
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
  const realizedCad = total(closedRows.filter(isCad));
  // US$ + C$ 합친 평가액 (2026-11-18) — 환율이 있을 때만, 환율 · 날짜를 같이 적는다
  const fxRate = fx?.usdcad && fx.usdcad > 0 ? fx.usdcad : null;
  const combined = fxRate && heldCad.n > 0 && held.n > 0
    ? { usd: held.value + heldCad.value / fxRate, cad: held.value * fxRate + heldCad.value } : null;
  const hasCad = rows.some((r) => !r.sample && isCad(r));

  // 매수이유별 성적 — 매도 완료 줄 (CAD 종목은 SPY 비교가 맞지 않아 뺀다)
  const reasons = useMemo(
    () => summarize(rows.filter((r) => r.closed && !r.sample && !isCad(r)).map((r) => calcTrade(r, bench))),
    [rows, bench],
  );

  // 다음 2주 실적 — 숫자 칸 요약 (있으면 아래 실적 카드에서 대응을 정한다)
  const earn = earningsItems(openRows, stockHints, today, isCad);
  const undecided = earn.filter((x) => !x.decision).length;

  const shown = filter === "open" ? openRows : filter === "closed" ? closedRows : [...openRows, ...closedRows, ...sampleRows];
  const selected = editing && editing.kind !== "new" ? editing.row.row : null;
  const filters: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: A.filterAll, n: rows.length },
    { key: "open", label: A.statusOpen, n: openRows.length },
    { key: "closed", label: A.statusClosed, n: closedRows.length },
  ];

  return (
    <>
      <section className="acct-kpis" aria-label={t.today.summary}>
        <Kpi label={A.totalValue} icon="wallet">
          <div className="acct-kpi__row">
            <b className="acct-kpi__value num">{held.n ? usd(held.value, 0) : "—"}</b>
            <span className="acct-kpi__side num">{A.costSide(held.n ? usd(held.cost, 0) : "—")}</span>
          </div>
          {held.missing + heldCad.missing > 0 && (
            <div className="acct-kpi__sub" style={{ color: "var(--warn)" }}>{A.missingPrice(held.missing + heldCad.missing)}</div>
          )}
          {heldCad.n > 0 && <div className="acct-kpi__sub num">{A.cadLine(money(heldCad.value, true, 0), money(heldCad.cost, true, 0))}</div>}
          {combined && fx && (
            <div className="acct-kpi__sub num">{A.combined(usd(combined.usd, 0), money(combined.cad, true, 0), fxRate!.toFixed(4), fmtDate(fx.date, lang))}</div>
          )}
        </Kpi>
        <Kpi label={A.totalPnl} icon={held.pnl < 0 ? "trend-down" : "trend"} iconTone={held.n ? tone(held.pnl) : undefined}>
          <div className="acct-kpi__row">
            <b className={`acct-kpi__value num ${tone(held.n ? held.pnl : null)}`}>{held.n ? usd(held.pnl, 0) : "—"}</b>
            <span className={`acct-kpi__side num ${tone(held.pnl)}`}>{held.cost ? pct(held.pnl / held.cost) : "—"}</span>
          </div>
          {heldCad.n > 0 && (
            <div className="acct-kpi__sub num">
              <span className={tone(heldCad.pnl)}>{money(heldCad.pnl, true, 0)} ({heldCad.cost ? pct(heldCad.pnl / heldCad.cost) : "—"})</span>
            </div>
          )}
        </Kpi>
        <Kpi label={A.realized} icon="receipt">
          <div className="acct-kpi__row">
            <b className={`acct-kpi__value num ${tone(realized.n ? realized.pnl : null)}`}>{realized.n ? usd(realized.pnl, 0) : "—"}</b>
            <span className="acct-kpi__side">{A.realizedSub(realized.n, realized.n ? pct(realized.wins / realized.n, 0, false) : "—")}</span>
          </div>
          {realizedCad.n > 0 && (
            <div className="acct-kpi__sub num">
              <span className={tone(realizedCad.pnl)}>{money(realizedCad.pnl, true, 0)}</span>
              {" · "}{A.realizedSub(realizedCad.n, pct(realizedCad.wins / realizedCad.n, 0, false))}
            </div>
          )}
        </Kpi>
        <Kpi label={A.earnTile} icon="calendar" iconTone={earn.length ? "acct-kpi__icon--alert" : undefined}>
          {earn.length ? (
            <>
              <a className="acct-kpi__text" href="#acct-earnings">{A.earnTileSome(earn.length)}</a>
              <div className="acct-kpi__sub num">
                {A.earnTileFirst(earn[0].tk, `${fmtDate(earn[0].earn, lang, true)} · ${t.earn.badge(earn[0].days)}`)}
              </div>
              <div className="acct-kpi__sub" style={undecided ? { color: "var(--warn)", fontWeight: 600 } : undefined}>
                {undecided ? A.earnTileUndecided(undecided) : A.earnTileDecided}
              </div>
            </>
          ) : (
            <>
              <b className="acct-kpi__text">{A.earnTileNone}</b>
              <div className="acct-kpi__sub">{A.earnTileWhy}</div>
            </>
          )}
        </Kpi>
      </section>

      {/* 2026-10-29 — 실적 2주 안 보유 종목 (결정 마감 · 금액 · 대응). 있을 때만, 숫자 칸 바로 아래 */}
      {earn.length > 0 && <EarningsPanel rows={openRows} hints={stockHints} today={today} isCad={isCad} />}

      <div className="acct-duo">
        {mix}
        <RiskPanel rows={openRows} hints={stockHints} isCad={isCad} usdcad={fxRate}>
          <ReasonStats all={reasons.all} byReason={reasons.byReason} hasBench={Boolean(bench?.closes.length)} />
        </RiskPanel>
      </div>

      <section className="card acct-table" aria-labelledby="acct-title">
        <h2 id="acct-title" className="sr-only">{A.title}</h2>
        <div className="acct-toolbar">
          <button type="button" className="btn btn--primary" onClick={() => open({ kind: "new" })}>
            + {A.add}
          </button>
          <div className="seg" role="group" aria-label={A.filterAria}>
            {filters.map((f) => (
              <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label} <span className="num">{f.n}</span>
              </button>
            ))}
          </div>
          <span className="acct-toolbar__gap" />
          <button type="button" className="btn acct-toolbar__btn" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
            <Icon name="refresh" size={15} />
            {A.refresh}
          </button>
          <a className="link-strong" href={sheetUrl} target="_blank" rel="noopener noreferrer">
            {A.openSheet}
          </a>
        </div>

        {notice && (
          <p role="status" className={`form-msg ${notice.ok ? "form-msg--good" : "form-msg--bad"}`} style={{ marginBottom: 10 }}>
            {notice.message}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="muted" style={{ margin: "12px 0 0" }}>{A.empty}</p>
        ) : shown.length === 0 ? (
          <p className="muted" style={{ margin: "12px 0 0" }}>{A.noneInFilter}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--tight data-table--pin acct-grid">
              <thead>
                <tr>
                  <th scope="col">{A.colStockKind}</th>
                  <th scope="col" className="r">{A.colBuyQty}</th>
                  <th scope="col" className="r" title={A.priceNote}>
                    {filter === "closed" ? A.colSellValue : A.colPriceValue}
                    <LiveDot mark={shown.find((r) => r.priceLive)?.priceLive} t={t} />
                  </th>
                  <th scope="col" className="r" title={A.vsSpyNote}>{A.colPnlSpy}</th>
                  <th scope="col" className="r" title={t.list.sqzNote}>{A.colStopRsi}</th>
                  <th scope="col">{A.colReasonMemo}</th>
                  <th scope="col" className="r">{A.colManage}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const c = calc(r);
                  const cad = isCad(r);
                  const live = !r.closed && !r.sample;
                  const tk = r.input.ticker.toUpperCase();
                  const rsi = Number(r.rsiDaily);
                  const spy = !cad && r.input.buyDate ? spyReturn(bench, r.input.buyDate, r.closed ? r.input.sellDate : null) : null;
                  const excess = c.ret != null && spy != null ? c.ret - spy : null;
                  const stopGap = live && r.stop && r.price ? r.price / r.stop - 1 : null;
                  const targetGap = live && r.target && r.price ? r.target / r.price - 1 : null;
                  const days = daysBetween(r.input.buyDate, r.closed ? r.input.sellDate : today);
                  const style = live ? styles[tk] : undefined;
                  const memo = [r.input.reason, r.input.memo].filter(Boolean).join(" · ");
                  const shares = r.shares != null ? A.qty(r.shares.toLocaleString("en-US")) : "—";
                  const priceTitle = r.priceSheetLive ? A.priceSheetTitle : r.priceSite ? A.priceSiteTitle : undefined;
                  return (
                    <tr key={r.row} data-selected={selected === r.row} data-closed={r.closed || undefined}
                      data-sample={r.sample || undefined}>
                      <td>
                        <div className="acct-tk">
                          <TickerLink ticker={r.input.ticker} />
                          <span className={`badge acct-status${r.closed ? " acct-status--closed" : ""}`}
                            title={r.sample ? A.sampleTitle : undefined}>
                            {r.sample ? A.statusSample : r.closed ? A.statusClosed : A.statusOpen}
                          </span>
                          {style?.cycle && (
                            <span className={`badge acct-cyc acct-cyc--${style.cycle}`} title={styleTitle(t, style)}>
                              {t.style.cycleShort[style.cycle]}
                            </span>
                          )}
                        </div>
                        <div className="cell-sub acct-tk__sub">
                          {[r.input.company, cad ? r.input.exchange : "", sector(lang, r.input.sector)].filter(Boolean).join(" · ")}
                        </div>
                        {/* 매수 뒤 분할했는데 시트가 분할 전 기준 (지금 가격 × 비율이 매수가에 더 가깝다) — 계좌 감시 ✂️ 알림과 같은 판정 */}
                        {live && (() => {
                          const sp = splits[tk];
                          const b = r.buyPrice;
                          const p = r.price;
                          if (!sp || !b || !p || (r.input.buyDate && r.input.buyDate >= sp.date)) return null;
                          if (Math.abs(Math.log((p * sp.ratio) / b)) >= Math.abs(Math.log(p / b))) return null;
                          return (
                            <div className="cell-sub acct-flag">
                              ✂️ {A.splitFix(splitLabel(sp.ratio), fmtDate(sp.date, lang))}
                            </div>
                          );
                        })()}
                        {live && r.secFlags && <div className="cell-sub acct-flag" title={t.sec.title}>{r.secFlags}</div>}
                      </td>
                      <td className="r num">
                        <div>{priceMoney(r.buyPrice, cad)} · {shares}</div>
                        <div className="cell-sub">
                          {r.input.buyDate ? fmtDate(r.input.buyDate, lang) : ""}
                          {days != null && days >= 0 && <span title={t.journal.colHeld}> ({t.journal.days(days)})</span>}
                          {days != null && days < 0 && (
                            <span style={{ color: "var(--warn)" }} title={A.futureDateTitle}> ({A.futureDate})</span>
                          )}
                        </div>
                      </td>
                      <td className="r num">
                        <div className="acct-strong" title={priceTitle}>
                          <Flash v={r.closed ? r.sellPrice : r.price}>{priceMoney(r.closed ? r.sellPrice : r.price, cad)}</Flash>
                          {/* 장중 펄스(15분) 가격이면 작은 파란 점 — 시트 '실시간가'가 있는 줄은 그 값 그대로 (2026-11-09) */}
                          {live && r.priceLive && <LiveDot mark={r.priceLive} t={t} />}
                        </div>
                        <div className="cell-sub">
                          {money(c.value, cad, 0)}
                          {r.closed && ` · ${A.soldOn(fmtDate(r.input.sellDate, lang))}`}
                          {live && r.priceSite && <span title={A.priceSiteTitle}> · {A.priceSite}</span>}
                        </div>
                      </td>
                      <td className="r num">
                        <div className={`acct-strong ${tone(c.pnl)}`}>
                          {money(c.pnl, cad, 0)} ({pct(c.ret)})
                        </div>
                        {spy != null && (
                          <div className={`cell-sub ${tone(excess)}`} title={A.spyTitle(pct(spy), pp(c.ret, spy))}>
                            {A.spyVs(pp(c.ret, spy))}
                          </div>
                        )}
                      </td>
                      <td className="r num">
                        {live ? (
                          <>
                            <div>
                              {A.stopShort}{" "}
                              {r.stop ? (
                                <>
                                  {priceMoney(r.stop, cad)}
                                  {stopGap != null && (
                                    <span className={`acct-gap${stopGap < 0 ? " acct-gap--bad" : stopGap <= 0.03 ? " acct-gap--warn" : ""}`}
                                      title={stopGap < 0 ? A.stopBelowTitle(pct(-stopGap, 1, false)) : A.stopNearTitle(pct(stopGap, 1, false))}>
                                      {" "}({pct(stopGap)})
                                    </span>
                                  )}
                                </>
                              ) : "—"}
                            </div>
                            {r.target != null && (
                              <div title={A.targetHint}>
                                {A.targetShort} {priceMoney(r.target, cad)}
                                {targetGap != null && (targetGap <= 0
                                  ? <> <span className="badge badge--good">{A.targetHit}</span></>
                                  : <span className="acct-gap" title={A.targetGapTitle}> ({pct(targetGap)})</span>)}
                              </div>
                            )}
                            <div className="cell-sub acct-rsi">
                              <span style={{ color: rsi >= 70 ? "var(--warn)" : undefined }}>RSI {r.rsiDaily || "—"}</span>
                              {/* SQZ 모멘텀 일·주·월 — 보유 중이라 늘 보인다 (힘 빠짐 2봉째 ⚠ = 팔 때 참고) */}
                              {sqz[tk] && <SqzMini sqz={sqz[tk]} />}
                            </div>
                          </>
                        ) : "—"}
                      </td>
                      <td className="acct-memo-cell">
                        {memo ? <span className="acct-memo" title={memo}>{memo}</span> : <span className="muted">—</span>}
                      </td>
                      <td className="r">
                        <div className="acct-actions">
                          <button type="button" className="btn btn--small" onClick={() => open({ kind: "edit", row: r })}
                            aria-label={`${A.edit} ${r.input.ticker}`}>
                            {A.edit}
                          </button>
                          {live ? (
                            <button type="button" className="btn btn--small acct-sell" onClick={() => open({ kind: "sell", row: r })}
                              aria-label={`${A.sell} ${r.input.ticker}`}>
                              {A.sell}
                            </button>
                          ) : (
                            <DeleteForm row={r} action={delAction} pending={delPending} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="tiny muted" style={{ margin: "10px 0 0" }}>{A.priceNote} {A.vsSpyNote}.</p>
      </section>

      {editing && (
        <div id="account-editor" style={{ scrollMarginTop: 80 }}>
          {editing.kind === "sell" ? (
            <SellForm key={`sell-${editing.row.row}`} row={editing.row} today={today} onDone={finish} onCancel={() => setEditing(null)} />
          ) : (
            <>
              <AccountForm key={editing.kind === "new" ? `new-${editing.prefill?.ticker ?? ""}` : editing.row.row}
                row={editing.kind === "edit" ? editing.row : null} prefill={editing.kind === "new" ? editing.prefill : undefined}
                onDone={finish} onCancel={() => setEditing(null)} delPending={delPending} />
              {editing.kind === "edit" && <DeleteForm row={editing.row} action={delAction} pending={delPending} button={false} />}
            </>
          )}
        </div>
      )}

      <div className="acct-duo">
        {news}
        <SizingCalc hints={stockHints} usdcad={fxRate} onUse={(p) => open({ kind: "new", prefill: p })} />
      </div>

      {hasCad && fx && fxRate && <p className="tiny muted acct-fxfoot">{A.fxFoot(fxRate.toFixed(4), fmtDate(fx.date, lang))}</p>}
    </>
  );
}
