"use client";

import Link from "next/link";
import { createContext, useActionState, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useT } from "./LangProvider";
import { canTrade, saveRow } from "@/app/quant/account/actions";
import { saveWatch } from "@/app/quant/watchlist/actions";
import type { ActionState } from "@/lib/actionUtils";
import { pct, todayToronto, usd } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import { keepForm } from "@/lib/keepForm";
import { loadSizing, positionShares, stopFrom, toNumber } from "@/lib/sizing";
import type { TickerInfo, Timeframe } from "@/lib/types";

// 차트 옆 '매수' → 작은 팝업 → 내계좌 시트에 한 줄 (페이퍼 트레이딩을 최대한 간단하게, 2026-10-19).
// 저장은 내계좌 '거래 추가'와 같은 서버 액션(saveRow)이라 검사·시트 쓰기가 똑같다. 고민 중이면 관심종목(saveWatch)에.

// from: 어디서 눌렀는지 — 메모 첫머리 ('차트에서 매수' · '관심종목에서 매수')
export type BuyRequest = { ticker: string; info: TickerInfo | null; tf?: Timeframe; from?: "chart" | "watch" };

const BuyContext = createContext<((req: BuyRequest) => void) | null>(null);

/** /quant 아래 어디서나 openBuy(...) 로 팝업을 연다 — 팝업은 하나만 그린다. */
export function BuyProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<BuyRequest | null>(null);
  const close = useCallback(() => setReq(null), []);
  return (
    <BuyContext value={setReq}>
      {children}
      {req && <BuyDialog key={`${req.ticker}-${req.tf ?? ""}`} req={req} onClose={close} />}
    </BuyContext>
  );
}

/** 차트·종목 옆 '매수' 버튼. */
export function BuyButton({ ticker, info, tf, from, compact = false }: {
  ticker: string;
  info: TickerInfo | null;
  tf?: Timeframe;
  from?: BuyRequest["from"];
  compact?: boolean;
}) {
  const { t } = useT();
  const open = useContext(BuyContext);
  if (!open) return null;
  return (
    <button type="button" className={`btn btn--buy${compact ? " btn--buy-compact" : " btn--small"}`}
      aria-label={t.buy.buttonAria(ticker)} onClick={() => open({ ticker, info, tf, from })}>
      + {t.buy.button}
    </button>
  );
}

const AMOUNTS = [500, 1000, 2500];
const TARGET_PCTS = [0.1, 0.2];
const TARGET_RS = [2, 3]; // 손익비 1:R — 목표 = 매수가 + R × (매수가 − 손절가)
const MEMO_MAX = 300;

/** 산 순간의 신호를 한 줄로 — 나중에 '왜 샀더라'를 복기할 때 쓴다. watch = 관심종목 탭에 적는 메모. */
function contextMemo(req: BuyRequest, t: Dict, watch = false): string {
  const { info, tf } = req;
  const lead = req.from === "watch" ? t.buy.fromWatch : watch ? t.buy.fromChartWatch : t.buy.fromChart;
  const parts: string[] = [tf ? `${lead} (${t.buy.fromTf(t.common.tf[tf])})` : lead];
  if (info) {
    if (info.score != null) parts.push(`★${info.score.toFixed(1)}`);
    if (info.strategy) parts.push(info.strategy);
    const pats = ([["Daily", info.patterns.daily], ["Weekly", info.patterns.weekly], ["Monthly", info.patterns.monthly]] as const)
      .filter(([, p]) => p.length)
      .map(([k, p]) => `${t.common.tf[k]} ${p.slice(0, 2).join("·")}`);
    parts.push(...pats);
    // 예고 (진행 중인 주·월봉이 지금 가격으로 끝나면 바뀌는 교차 라벨) — 봉 중간에 산 이유를 나중에 알 수 있게
    for (const [k, v] of [["Weekly", info.preview?.weekly], ["Monthly", info.preview?.monthly]] as const) {
      if (v) parts.push(`${t.common.tf[k]} ${t.list.preview} ${v}`);
    }
    if (info.rsi != null) parts.push(`RSI ${info.rsi.toFixed(0)}`);
    if (info.ret_20d != null) parts.push(`20D ${pct(info.ret_20d)}`);
  }
  return parts.join(" · ").slice(0, MEMO_MAX);
}

const round2 = (v: number) => String(Number(v.toFixed(2)));

type Auth = "checking" | "ok" | "no";

function BuyDialog({ req, onClose }: { req: BuyRequest; onClose: () => void }) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"buy" | "watch">("buy");
  const [auth, setAuth] = useState<Auth>("checking");
  const [round, setRound] = useState(0); // '하나 더' → 폼을 새로

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // 자식(폼)의 effect 는 showModal 전에 돌아 focus 가 안 먹는다 → 열린 다음 수량 칸으로
    d?.querySelector<HTMLInputElement>("#buy-shares")?.focus();
  }, []);

  // 처음 열 때 한 번 (상태는 이미 'checking'), '다시 확인'을 누르면 또
  useEffect(() => {
    let alive = true;
    canTrade().then((ok) => alive && setAuth(ok ? "ok" : "no"), () => alive && setAuth("no"));
    return () => {
      alive = false;
    };
  }, []);
  const check = useCallback(() => {
    setAuth("checking");
    canTrade().then((ok) => setAuth(ok ? "ok" : "no"), () => setAuth("no"));
  }, []);

  const { ticker, info } = req;
  return (
    <dialog ref={ref} className="buy-dialog" aria-labelledby="buy-title" onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}>
      <div className="buy-dialog__body">
        <div className="buy-dialog__head">
          <div>
            <h2 id="buy-title">{t.buy.title(ticker)}</h2>
            {info?.company && <p className="small muted" style={{ margin: "2px 0 0" }}>{info.company}</p>}
          </div>
          <button type="button" className="buy-dialog__x" aria-label={t.buy.close} onClick={() => ref.current?.close()}>×</button>
        </div>
        <div className="seg" role="group" aria-label={t.buy.modeAria}>
          <button type="button" aria-pressed={mode === "buy"} onClick={() => setMode("buy")}>{t.buy.modeBuy}</button>
          <button type="button" aria-pressed={mode === "watch"} onClick={() => setMode("watch")}>{t.buy.modeWatch}</button>
        </div>
        {auth === "no" && (
          <div className="form-msg form-msg--bad buy-dialog__login" role="alert">
            <span>{t.buy.needLogin}</span>
            <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="btn btn--small" href="/quant/account" target="_blank" rel="noopener">{t.buy.openAccount}</a>
              <button type="button" className="btn btn--small" onClick={check}>{t.buy.recheck}</button>
            </span>
          </div>
        )}
        {auth === "checking" && <p className="tiny muted" style={{ margin: 0 }}>{t.buy.checking}</p>}
        {mode === "buy" ? (
          <BuyForm key={`b${round}`} req={req} canSave={auth === "ok"} onAnother={() => setRound((n) => n + 1)}
            onClose={() => ref.current?.close()} />
        ) : (
          <WatchForm key={`w${round}`} req={req} canSave={auth === "ok"} onClose={() => ref.current?.close()} />
        )}
      </div>
    </dialog>
  );
}

function BuyForm({ req, canSave, onAnother, onClose }: {
  req: BuyRequest;
  canSave: boolean;
  onAnother: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const { ticker, info } = req;
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRow, null);
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState(info?.price != null ? round2(info.price) : "");
  const [date, setDate] = useState(() => todayToronto());
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [memo, setMemo] = useState(() => contextMemo(req, t));
  const [sizing] = useState(() => loadSizing()); // 내계좌 계산기 설정 (이 브라우저)
  const sharesRef = useRef<HTMLInputElement>(null);
  useEffect(() => sharesRef.current?.focus(), []);

  const p = toNumber(price);
  const n = toNumber(shares);
  const s = toNumber(stop);
  const tg = toNumber(target);
  const stopOk = s > 0 && s < p;
  const atr = info?.atr_pct ?? null;
  const acc = sizing ? toNumber(sizing.account) : NaN;
  const sized = positionShares({
    account: acc, riskPct: sizing ? toNumber(sizing.riskPct) : NaN, maxPos: sizing ? toNumber(sizing.maxPos) : NaN,
    entry: p, stop: s,
  });
  const ready = n > 0 && p > 0 && reason.trim() !== "" && canSave;

  if (state?.ok) {
    return (
      <div className="buy-dialog__done">
        <p className="form-msg form-msg--good" role="status">{t.buy.done(ticker, shares)}</p>
        <div className="account-form__actions">
          <Link className="btn btn--primary" href="/quant/account" onClick={onClose}>{t.buy.viewAccount}</Link>
          <button type="button" className="btn" onClick={onAnother}>{t.buy.another}</button>
          <button type="button" className="btn" onClick={onClose}>{t.buy.close}</button>
        </div>
      </div>
    );
  }

  return (
    <form className="buy-form" onSubmit={keepForm(action)}>
      <input type="hidden" name="ticker" value={ticker} />
      <input type="hidden" name="company" value={info?.company ?? ""} />
      <input type="hidden" name="sector" value={info?.sector ?? ""} />
      <input type="hidden" name="exchange" value="" />

      <div className="buy-form__row">
        <label className="field" htmlFor="buy-shares">
          <span className="field__label">{t.buy.shares}</span>
          <input ref={sharesRef} id="buy-shares" name="shares" className="input buy-form__big" inputMode="decimal"
            value={shares} onChange={(e) => setShares(e.target.value)} placeholder="0" required autoComplete="off" />
        </label>
        <label className="field" htmlFor="buy-price">
          <span className="field__label">{t.buy.price}</span>
          <input id="buy-price" name="buyPrice" className="input buy-form__big" inputMode="decimal" value={price}
            onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required autoComplete="off" />
        </label>
      </div>
      <div className="buy-form__quick" role="group" aria-label={t.buy.byAmount}>
        <span className="tiny muted">{t.buy.byAmount}</span>
        {AMOUNTS.map((a) => (
          <button key={a} type="button" className="pill pill--small" disabled={!(p > 0)}
            onClick={() => setShares(String(Math.max(1, Math.floor(a / p))))}>
            {usd(a, 0)}
          </button>
        ))}
        {sized && sized.shares > 0 && (
          <button type="button" className="pill pill--small" title={t.buy.riskTitle}
            onClick={() => setShares(String(sized.shares))}>
            {t.buy.byRisk(sizing?.riskPct ?? "1")} → {sized.shares}
          </button>
        )}
      </div>
      {info?.price == null && <p className="tiny" style={{ margin: 0, color: "var(--warn)" }}>{t.buy.noPrice}</p>}
      {info?.price != null && <p className="tiny muted" style={{ margin: 0 }}>{t.buy.priceHint}</p>}

      <div className="buy-form__row">
        <div className="field">
          <label className="field__label" htmlFor="buy-stop">{t.buy.stop}</label>
          <input id="buy-stop" name="stop" className="input" inputMode="decimal" value={stop}
            onChange={(e) => setStop(e.target.value)} placeholder="—" autoComplete="off" />
          <div className="buy-form__quick">
            <button type="button" className="pill pill--small" disabled={!(p > 0)} onClick={() => setStop(round2(stopFrom(p, "pct", null)))}>
              {t.buy.stopPct}
            </button>
            {atr != null && atr > 0 && (
              <button type="button" className="pill pill--small" disabled={!(p > 0)}
                onClick={() => setStop(round2(stopFrom(p, "atr", atr)))}>
                {t.buy.stopAtr} ({pct(atr, 1, false)})
              </button>
            )}
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="buy-target">{t.buy.targetSell}</label>
          <input id="buy-target" name="target" className="input" inputMode="decimal" value={target}
            onChange={(e) => setTarget(e.target.value)} placeholder="—" autoComplete="off" />
          <div className="buy-form__quick">
            {TARGET_PCTS.map((x) => (
              <button key={x} type="button" className="pill pill--small" disabled={!(p > 0)}
                onClick={() => setTarget(round2(p * (1 + x)))}>
                +{x * 100}%
              </button>
            ))}
            {TARGET_RS.map((r) => (
              <button key={r} type="button" className="pill pill--small" disabled={!stopOk} title={t.buy.rrTitle(r)}
                onClick={() => setTarget(round2(p + r * (p - s)))}>
                1:{r}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>{t.buy.stopTargetHint}</p>
      <div className="buy-form__row">
        <label className="field" htmlFor="buy-date">
          <span className="field__label">{t.buy.date}</span>
          <input id="buy-date" name="buyDate" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {date > todayToronto() && <p className="tiny" style={{ margin: 0, color: "var(--warn)" }}>{t.account.futureDateTitle}</p>}
      {!sizing?.account && <p className="tiny muted" style={{ margin: 0 }}>{t.buy.noSizing}</p>}

      <fieldset className="buy-form__reason">
        <legend className="field__label">{t.buy.reason}</legend>
        <div className="buy-form__quick">
          {t.account.reasonList.map((r) => (
            <button key={r} type="button" className="pill pill--small" aria-pressed={reason === r} onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
        </div>
        <input name="reason" className="input" value={reason} maxLength={40} onChange={(e) => setReason(e.target.value)}
          placeholder={t.buy.reasonPh} aria-label={t.buy.reason} autoComplete="off" />
      </fieldset>

      <label className="field" htmlFor="buy-memo">
        <span className="field__label">{t.buy.memo}</span>
        <textarea id="buy-memo" name="memo" className="input buy-form__memo" rows={2} maxLength={MEMO_MAX} value={memo}
          onChange={(e) => setMemo(e.target.value)} />
        <span className="tiny muted">{t.buy.memoHint}</span>
      </label>

      {n > 0 && p > 0 && (
        <p className="small buy-form__sum">
          <span className="num">{t.buy.cost(usd(n * p))}</span>
          {stopOk && (
            <span className="num down">{t.buy.riskLine(usd((s - p) * n), pct(s / p - 1))}</span>
          )}
          {tg > p && <span className="num up">{t.buy.rewardLine(usd((tg - p) * n), pct(tg / p - 1))}</span>}
          {tg > p && stopOk && <span className="num">{t.buy.rrLine(((tg - p) / (p - s)).toFixed(1))}</span>}
        </p>
      )}
      {tg > 0 && p > 0 && tg <= p && <p className="tiny" style={{ margin: 0, color: "var(--warn)" }}>{t.buy.targetLow}</p>}
      {state && !state.ok && <p role="alert" className="form-msg form-msg--bad">{state.message}</p>}
      {!reason.trim() && n > 0 && <p className="tiny muted" style={{ margin: 0 }}>{t.buy.reasonNeed}</p>}
      <div className="account-form__actions">
        <button type="submit" className="btn btn--primary" disabled={!ready || pending}>
          {pending ? t.buy.saving : t.buy.submit}
        </button>
        <button type="button" className="btn" onClick={onClose} disabled={pending}>{t.buy.cancel}</button>
      </div>
    </form>
  );
}

function WatchForm({ req, canSave, onClose }: { req: BuyRequest; canSave: boolean; onClose: () => void }) {
  const { t } = useT();
  const { ticker, info } = req;
  const [state, action, pending] = useActionState<ActionState, FormData>(saveWatch, null);
  const [target, setTarget] = useState(info?.price != null ? round2(info.price) : "");
  const [cond, setCond] = useState<"이하" | "이상">("이하");
  const [memo, setMemo] = useState(() => contextMemo(req, t, true));

  if (state?.ok) {
    return (
      <div className="buy-dialog__done">
        <p className="form-msg form-msg--good" role="status">{t.buy.watchDone(ticker)}</p>
        <div className="account-form__actions">
          <Link className="btn btn--primary" href="/quant/watchlist" onClick={onClose}>{t.buy.viewWatch}</Link>
          <button type="button" className="btn" onClick={onClose}>{t.buy.close}</button>
        </div>
      </div>
    );
  }
  return (
    <form className="buy-form" onSubmit={keepForm(action)}>
      <p className="small muted" style={{ margin: 0 }}>{t.buy.watchHelp}</p>
      <input type="hidden" name="ticker" value={ticker} />
      <input type="hidden" name="added" value="" />
      <input type="hidden" name="cond" value={cond} />
      <div className="buy-form__row">
        <label className="field" htmlFor="watch-target">
          <span className="field__label">{t.buy.target}</span>
          <input id="watch-target" name="target" className="input buy-form__big" inputMode="decimal" value={target}
            onChange={(e) => setTarget(e.target.value)} autoComplete="off" />
        </label>
        <div className="field">
          <span className="field__label" id="watch-cond">{t.buy.cond}</span>
          <div className="seg" role="radiogroup" aria-labelledby="watch-cond">
            {([["이하", t.buy.condBelow], ["이상", t.buy.condAbove]] as const).map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={cond === v} aria-pressed={cond === v} onClick={() => setCond(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <label className="field" htmlFor="watch-memo">
        <span className="field__label">{t.buy.memo}</span>
        <textarea id="watch-memo" name="memo" className="input buy-form__memo" rows={2} maxLength={MEMO_MAX} value={memo}
          onChange={(e) => setMemo(e.target.value)} />
      </label>
      {state && !state.ok && <p role="alert" className="form-msg form-msg--bad">{state.message}</p>}
      <div className="account-form__actions">
        <button type="submit" className="btn btn--primary" disabled={!canSave || pending}>
          {pending ? t.buy.saving : t.buy.watchSubmit}
        </button>
        <button type="button" className="btn" onClick={onClose} disabled={pending}>{t.buy.cancel}</button>
      </div>
    </form>
  );
}
