"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { useT } from "./LangProvider";
import type { AccountRow } from "@/lib/account";
import { num, pct, usd } from "@/lib/format";
import { sector } from "@/lib/i18n";
import type { EarningsMove } from "@/lib/types";

// move = 웹 종목 정보의 실적 때 움직임 (2026-10-29) — 실적 일정·금액은 EarningsPanel '다음 2주 실적'이 보여 준다
// cycle = 경기방어/순환 (2026-11-26) — '가장 큰 종목' 아래 '방어주 · 필수소비재'
export type StockHint = {
  sector: string | null;
  earnings: string | null;
  atr: number | null;
  price: number | null;
  move?: EarningsMove | null;
  cycle?: "cyclical" | "defensive" | null;
};

// 경험칙 경고 기준 (검증된 최적값이 아니다 — 화면에도 그렇게 적는다)
const MAX_POS = 0.25;
const MAX_SECTOR = 0.4;
const MAX_HEAT = 0.06;

/**
 * 보유 종목 리스크 (2026-11-26 사용자 시안으로 개편) — 베타 · 평균상관 · 다 손절되면 손실 · 가장 큰 종목 네 칸, 그 아래 경고 띠
 * (손절가 아래로 내려온 종목은 빨강), children 자리에 매수이유별 성적. 섹터 비중 막대는 쏠림 카드 아래 줄로 옮겼다.
 * 실적 일정은 EarningsPanel.
 */
export function RiskPanel({ rows, hints, isCad, usdcad, children }: {
  rows: AccountRow[];
  hints: Record<string, StockHint>;
  isCad: (r: AccountRow) => boolean;
  /** 1 US$ = usdcad C$ (경제 탭 환율) — 있으면 캐나다 종목도 US$ 로 바꿔 넣는다 (2026-11-18, 예전엔 빠졌다) */
  usdcad?: number | null;
  /** 카드 아래쪽 — 매수이유별 성적 */
  children?: ReactNode;
}) {
  const { lang, t } = useT();
  const fx = usdcad != null && usdcad > 0 ? usdcad : null;
  const toUsd = (r: AccountRow) => (isCad(r) ? (fx ? 1 / fx : null) : 1);
  const usable = rows
    .filter((r) => toUsd(r) != null && r.price != null && r.shares != null && r.shares > 0)
    .map((r) => ({ r, value: (r.price as number) * (r.shares as number) * (toUsd(r) as number) }));
  const leftOut = rows.filter((r) => isCad(r) && !fx).length;
  const total = usable.reduce((a, x) => a + x.value, 0);

  const head = (
    <div className="acct-card-head">
      <h2 id="risk-title">{t.risk.title}</h2>
      <span className="acct-card-head__side" title={t.risk.subTitle}>{t.risk.sub}</span>
    </div>
  );
  if (!usable.length || total <= 0) {
    return (
      <section className="card acct-risk" aria-labelledby="risk-title">
        {head}
        <p className="small muted" style={{ margin: "12px 0 0" }}>{t.risk.noHeld}</p>
        {children}
      </section>
    );
  }

  const w = (v: number) => v / total;
  // 가장 큰 종목 — 같은 종목 여러 줄(부분 매도 · 추가 매수)은 합쳐서 (2026-11-18, 예전엔 줄 하나씩 봐서 15% + 15% 가 안 걸렸다)
  const byStock = new Map<string, { r: AccountRow; value: number }>();
  for (const x of usable) {
    const k = x.r.input.ticker.toUpperCase();
    const cur = byStock.get(k);
    byStock.set(k, { r: cur?.r ?? x.r, value: (cur?.value ?? 0) + x.value });
  }
  const biggest = [...byStock.values()].reduce((a, b) => (b.value > a.value ? b : a));
  const sectorOf = (r: AccountRow) => r.input.sector || hints[r.input.ticker]?.sector || "";

  const bySector = new Map<string, number>();
  for (const { r, value } of usable) bySector.set(sectorOf(r), (bySector.get(sectorOf(r)) ?? 0) + value);
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
  // 손절가 아래로 내려온 종목 (2026-11-26) — '다 손절되면'은 이미 넘은 종목을 0 으로 세서 위험이 안 보였다
  const below = withStop
    .filter((x) => (x.r.price as number) < (x.r.stop as number))
    .map((x) => `${x.r.input.ticker} ${pct((x.r.price as number) / (x.r.stop as number) - 1)}`);

  const warnings: string[] = [];
  if (w(biggest.value) > MAX_POS) warnings.push(t.risk.warnPos(biggest.r.input.ticker, pct(w(biggest.value), 0, false)));
  for (const s of sectors) {
    if (s.w > MAX_SECTOR) warnings.push(t.risk.warnSector(sector(lang, s.s) || t.risk.unknownSector, pct(s.w, 0, false)));
  }
  if (heat / total > MAX_HEAT) warnings.push(t.risk.warnHeat(pct(heat / total, 1, false)));
  if (noStop) warnings.push(t.risk.warnNoStop(noStop));

  const bigCycle = hints[biggest.r.input.ticker]?.cycle;
  const bigSector = sectorOf(biggest.r);
  const bigSub = [bigCycle ? t.risk.cycleShort[bigCycle] : "", bigSector ? sector(lang, bigSector) : ""].filter(Boolean).join(" · ");

  return (
    <section className="card acct-risk" aria-labelledby="risk-title">
      {head}
      <dl className="acct-stats">
        <div className="acct-stat">
          <dt>{t.risk.beta}</dt>
          <dd className="acct-stat__v num">{num(beta)}</dd>
          <dd className="acct-stat__s">{t.risk.betaSub}</dd>
        </div>
        <div className="acct-stat" title={t.risk.corrTitle}>
          <dt>{t.risk.corr}</dt>
          <dd className="acct-stat__v num">{num(corr)}</dd>
          <dd className="acct-stat__s">{corr != null ? t.risk.corrLevel(corr) : t.risk.corrSub}</dd>
        </div>
        <div className="acct-stat">
          <dt>{t.risk.heat}</dt>
          <dd className="acct-stat__v num down">{withStop.length ? `${usd(-heat, 0)} (${pct(-heat / total, 0)})` : "—"}</dd>
          <dd className="acct-stat__s">{t.risk.heatSub(noStop)}</dd>
        </div>
        <div className="acct-stat">
          <dt>{t.risk.biggest}</dt>
          <dd className="acct-stat__v num">{biggest.r.input.ticker} {pct(w(biggest.value), 0, false)}</dd>
          {bigSub && <dd className="acct-stat__s">{bigSub}</dd>}
        </div>
      </dl>
      {beta == null && corr == null && <p className="tiny muted" style={{ margin: "8px 0 0" }}>{t.risk.noData}</p>}
      {leftOut > 0 && <p className="tiny" style={{ margin: "8px 0 0", color: "var(--warn)" }}>{t.risk.cadLeftOut(leftOut)}</p>}

      {(below.length > 0 || warnings.length > 0) && (
        <ul className="acct-warn" role="list">
          {below.length > 0 && (
            <li className="acct-warn__item acct-warn__item--bad">
              <Icon name="alert" size={15} />
              <span>{t.risk.warnBelowStop(below.join(", "))}</span>
            </li>
          )}
          {warnings.map((m) => (
            <li key={m} className="acct-warn__item">
              <Icon name="alert" size={15} />
              <span>{m}</span>
            </li>
          ))}
        </ul>
      )}
      {children}
      <p className="tiny muted acct-risk__rule">{t.risk.rule}</p>
    </section>
  );
}
