"use client";

import { useT } from "./LangProvider";
import type { AccountRow } from "@/lib/account";
import { num, pct, usd } from "@/lib/format";
import { sector } from "@/lib/i18n";
import type { EarningsMove } from "@/lib/types";

// move = 웹 종목 정보의 실적 때 움직임 (2026-10-29) — 실적 일정·금액은 EarningsPanel '다음 2주 실적'이 보여 준다
export type StockHint = {
  sector: string | null;
  earnings: string | null;
  atr: number | null;
  price: number | null;
  move?: EarningsMove | null;
};

// 경험칙 경고 기준 (검증된 최적값이 아니다 — 화면에도 그렇게 적는다)
const MAX_POS = 0.25;
const MAX_SECTOR = 0.4;
const MAX_HEAT = 0.06;

/** 보유 종목 리스크 — 베타·평균상관·다 손절되면 손실·종목/섹터 쏠림 (실적 일정은 EarningsPanel). */
export function RiskPanel({ rows, hints, isCad, usdcad }: {
  rows: AccountRow[];
  hints: Record<string, StockHint>;
  isCad: (r: AccountRow) => boolean;
  /** 1 US$ = usdcad C$ (경제 탭 환율) — 있으면 캐나다 종목도 US$ 로 바꿔 넣는다 (2026-11-18, 예전엔 빠졌다) */
  usdcad?: number | null;
}) {
  const { lang, t } = useT();
  const fx = usdcad != null && usdcad > 0 ? usdcad : null;
  const toUsd = (r: AccountRow) => (isCad(r) ? (fx ? 1 / fx : null) : 1);
  const usable = rows
    .filter((r) => toUsd(r) != null && r.price != null && r.shares != null && r.shares > 0)
    .map((r) => ({ r, value: (r.price as number) * (r.shares as number) * (toUsd(r) as number) }));
  const leftOut = rows.filter((r) => isCad(r) && !fx).length;
  const total = usable.reduce((a, x) => a + x.value, 0);
  if (!usable.length || total <= 0) return null;

  const w = (v: number) => v / total;
  // 가장 큰 종목 — 같은 종목 여러 줄(부분 매도 · 추가 매수)은 합쳐서 (2026-11-18, 예전엔 줄 하나씩 봐서 15% + 15% 가 안 걸렸다)
  const byStock = new Map<string, { r: AccountRow; value: number }>();
  for (const x of usable) {
    const k = x.r.input.ticker.toUpperCase();
    const cur = byStock.get(k);
    byStock.set(k, { r: cur?.r ?? x.r, value: (cur?.value ?? 0) + x.value });
  }
  const biggest = [...byStock.values()].reduce((a, b) => (b.value > a.value ? b : a));

  const bySector = new Map<string, number>();
  for (const { r, value } of usable) {
    const s = r.input.sector || hints[r.input.ticker]?.sector || "";
    bySector.set(s, (bySector.get(s) ?? 0) + value);
  }
  const sectors = [...bySector].map(([s, v]) => ({ s, w: w(v) })).sort((a, b) => b.w - a.w);

  const withBeta = usable.filter((x) => x.r.beta != null);
  const betaW = withBeta.reduce((a, x) => a + x.value, 0);
  const beta = betaW > 0 ? withBeta.reduce((a, x) => a + (x.r.beta as number) * x.value, 0) / betaW : null;
  const corrs = usable.map((x) => x.r.avgCorr).filter((v): v is number => v != null);
  const corr = corrs.length ? corrs.reduce((a, b) => a + b, 0) / corrs.length : null;

  const withStop = usable.filter((x) => x.r.stop != null && x.r.stop > 0);
  const heat = withStop.reduce((a, x) => a + Math.max(0, (x.r.price as number) - (x.r.stop as number)) * (x.r.shares as number)
    * (toUsd(x.r) as number), 0);
  const noStop = rows.filter((r) => !(r.stop != null && r.stop > 0)).length;

  const warnings: string[] = [];
  if (w(biggest.value) > MAX_POS) warnings.push(t.risk.warnPos(biggest.r.input.ticker, pct(w(biggest.value), 0, false)));
  for (const s of sectors) {
    if (s.w > MAX_SECTOR) warnings.push(t.risk.warnSector(sector(lang, s.s) || t.risk.unknownSector, pct(s.w, 0, false)));
  }
  if (heat / total > MAX_HEAT) warnings.push(t.risk.warnHeat(pct(heat / total, 1, false)));
  if (noStop) warnings.push(t.risk.warnNoStop(noStop));

  return (
    <section className="card" aria-labelledby="risk-title">
      <div className="section-head">
        <h2 id="risk-title">{t.risk.title}</h2>
        <p>{t.risk.sub}</p>
      </div>
      <dl className="stats">
        <div className="stat">
          <dt>{t.risk.beta}</dt>
          <dd className="num">{num(beta)}</dd>
          <dd className="stat__note">{t.risk.betaSub}</dd>
        </div>
        <div className="stat">
          <dt>{t.risk.corr}</dt>
          <dd className="num">{num(corr)}</dd>
          <dd className="stat__note">{t.risk.corrSub}</dd>
        </div>
        <div className="stat">
          <dt>{t.risk.heat}</dt>
          <dd className="num down">{withStop.length ? `${usd(-heat, 0)} (${pct(-heat / total)})` : "—"}</dd>
          <dd className="stat__note">{t.risk.heatSub(noStop)}</dd>
        </div>
        <div className="stat">
          <dt>{t.risk.biggest}</dt>
          <dd className="num">{biggest.r.input.ticker} {pct(w(biggest.value), 0, false)}</dd>
        </div>
      </dl>
      {beta == null && corr == null && <p className="tiny muted" style={{ margin: "8px 0 0" }}>{t.risk.noData}</p>}
      {fx && rows.some(isCad) && <p className="tiny muted" style={{ margin: "8px 0 0" }}>{t.risk.cadIncluded(fx.toFixed(4))}</p>}
      {leftOut > 0 && <p className="tiny muted" style={{ margin: "8px 0 0", color: "var(--warn)" }}>{t.risk.cadLeftOut(leftOut)}</p>}

      <div style={{ marginTop: 16 }}>
        <div>
          <h3 className="risk-h">{t.risk.sectors}</h3>
          <ul className="risk-bars">
            {sectors.map((s) => (
              <li key={s.s || "?"} className="risk-bar">
                <span className="risk-bar__label">{sector(lang, s.s) || t.risk.unknownSector}</span>
                <span className="risk-bar__track" aria-hidden="true">
                  <span className={`risk-bar__fill${s.w > MAX_SECTOR ? " risk-bar__fill--warn" : ""}`}
                    style={{ width: `${Math.max(2, s.w * 100)}%` }} />
                </span>
                <span className="risk-bar__val num">{pct(s.w, 0, false)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {warnings.length > 0 && (
        <ul className="risk-warn" role="list">
          {warnings.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
    </section>
  );
}
