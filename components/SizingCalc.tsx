"use client";

import { useEffect, useState } from "react";
import { useT } from "./LangProvider";
import type { StockHint } from "./RiskPanel";
import { pct, usd } from "@/lib/format";
import { loadSizing, positionShares, saveSizing, stopFrom, toNumber as n } from "@/lib/sizing";

export type SizingPrefill = { ticker: string; buyPrice: string; shares: string; stop: string };

type Mode = "atr" | "pct" | "manual";

/**
 * 포지션 크기 = min(계좌 × 1회 위험% ÷ 1주당 위험, 계좌 × 최대 비중 ÷ 매수가), 정수 주.
 * 1주당 위험 = 매수가 − 손절가. 손절가 = 매수가 × (1 − 2×ATR%) · × 0.92 · 직접.
 */
export function SizingCalc({ hints, onUse }: { hints: Record<string, StockHint>; onUse: (p: SizingPrefill) => void }) {
  const { t } = useT();
  const [account, setAccount] = useState("");
  const [riskPct, setRiskPct] = useState("1");
  const [maxPos, setMaxPos] = useState("25");
  const [ticker, setTicker] = useState("");
  const [entry, setEntry] = useState("");
  const [mode, setMode] = useState<Mode>("atr");
  const [manualStop, setManualStop] = useState("");

  useEffect(() => {
    const s = loadSizing();
    if (s) {
      setAccount(s.account ?? "");
      setRiskPct(s.riskPct || "1");
      setMaxPos(s.maxPos || "25");
    }
  }, []);
  useEffect(() => saveSizing({ account, riskPct, maxPos }), [account, riskPct, maxPos]);

  const hint = hints[ticker.toUpperCase()];
  const atr = hint?.atr ?? null;
  const pickTicker = (v: string) => {
    setTicker(v);
    const h = hints[v.toUpperCase()];
    if (h?.price) setEntry(String(Number(h.price.toFixed(2))));
  };

  const acc = n(account);
  const e = n(entry);
  const stop = mode === "manual" ? n(manualStop) : stopFrom(e, mode, atr);
  const perShare = e - stop;
  const sized = positionShares({ account: acc, riskPct: n(riskPct), maxPos: n(maxPos), entry: e, stop });
  const valid = sized != null;
  const shares = sized?.shares ?? 0;
  const capped = sized?.capped ?? false;

  const field = (id: string, label: string, el: React.ReactNode) => (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      {el}
    </label>
  );

  return (
    <section className="card" aria-labelledby="sizing-title">
      <div className="section-head">
        <h2 id="sizing-title">{t.sizing.title}</h2>
        <p>{t.sizing.sub}</p>
      </div>
      <div className="account-form__grid" style={{ marginTop: 12 }}>
        {field("sz-account", t.sizing.account,
          <input id="sz-account" className="input" inputMode="decimal" value={account} onChange={(ev) => setAccount(ev.target.value)} placeholder="5000" />)}
        {field("sz-risk", t.sizing.riskPct,
          <input id="sz-risk" className="input" inputMode="decimal" value={riskPct} onChange={(ev) => setRiskPct(ev.target.value)} />)}
        {field("sz-max", t.sizing.maxPos,
          <input id="sz-max" className="input" inputMode="decimal" value={maxPos} onChange={(ev) => setMaxPos(ev.target.value)} />)}
        {field("sz-ticker", t.sizing.ticker,
          <>
            <input id="sz-ticker" className="input" value={ticker} list="sz-tickers" autoCapitalize="characters" autoComplete="off"
              spellCheck={false} onChange={(ev) => pickTicker(ev.target.value.toUpperCase())} placeholder="AAPL" />
            <datalist id="sz-tickers">
              {Object.keys(hints).sort().map((tk) => <option key={tk} value={tk} />)}
            </datalist>
          </>)}
        {field("sz-entry", t.sizing.entry,
          <input id="sz-entry" className="input" inputMode="decimal" value={entry} onChange={(ev) => setEntry(ev.target.value)} placeholder="0.00" />)}
        <div className="field">
          <span className="field__label" id="sz-mode-label">{t.sizing.stopMode}</span>
          <div className="seg" role="radiogroup" aria-labelledby="sz-mode-label">
            {([["atr", t.sizing.atr2], ["pct", t.sizing.pct8], ["manual", t.sizing.manual]] as [Mode, string][]).map(([m, label]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} aria-pressed={mode === m}
                className="pill" onClick={() => setMode(m)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {mode === "manual" && field("sz-stop", t.sizing.stopPrice,
          <input id="sz-stop" className="input" inputMode="decimal" value={manualStop} onChange={(ev) => setManualStop(ev.target.value)} />)}
      </div>
      {mode === "atr" && ticker && atr == null && <p className="tiny muted" style={{ margin: "8px 0 0" }}>{t.sizing.noAtr}</p>}
      {mode === "atr" && atr != null && <p className="tiny muted" style={{ margin: "8px 0 0" }}>{t.sizing.atrNow(pct(atr, 1, false))}</p>}

      {valid ? (
        <>
          <dl className="stats">
            <div className="stat"><dt>{t.sizing.outStop}</dt><dd className="num">{usd(stop)}</dd></div>
            <div className="stat"><dt>{t.sizing.outPerShare}</dt><dd className="num">{usd(perShare)}</dd></div>
            <div className="stat"><dt>{t.sizing.outShares}</dt><dd className="num" style={{ fontSize: 20 }}>{shares}</dd></div>
            <div className="stat"><dt>{t.sizing.outValue}</dt><dd className="num">{usd(shares * e, 0)}</dd></div>
            <div className="stat"><dt>{t.sizing.outWeight}</dt><dd className="num">{pct((shares * e) / acc, 1, false)}</dd></div>
            <div className="stat"><dt>{t.sizing.outLoss}</dt><dd className="num down">{usd(-shares * perShare, 0)}</dd></div>
          </dl>
          {capped && <p className="tiny muted" style={{ margin: "8px 0 0" }}>{t.sizing.capped}</p>}
          {shares > 0 && ticker && (
            <div className="account-form__actions" style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => onUse({
                ticker: ticker.toUpperCase(), buyPrice: String(Number(e.toFixed(4))), shares: String(shares),
                stop: String(Number(stop.toFixed(2))),
              })}>
                {t.sizing.addToAccount}
              </button>
            </div>
          )}
        </>
      ) : (
        (account || entry) && <p className="small muted" style={{ margin: "12px 0 0" }}>{t.sizing.invalid}</p>
      )}
    </section>
  );
}
