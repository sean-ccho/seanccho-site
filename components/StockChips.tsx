"use client";

import { InsiderBadge } from "./InsiderBadge";
import { useT } from "./LangProvider";
import { SecFlagChips } from "./SecFlags";
import { ShortChips } from "./SqueezePanel";
import { fmtDate, gradeTone, num, pct, tone } from "@/lib/format";
import { term } from "@/lib/i18n";
import { crossMarks } from "@/lib/stockList";
import type { TickerInfo } from "@/lib/types";

const HOT_VOLUME = 1.5; // 20일 평균의 1.5배 넘으면 강조

/** 크로스(봉·이동평균 간격) · PT 골든크로스 · 거래량 · 내부자 — 후보·차트 페이지 공통. */
export function SignalChips({ info }: { info: TickerInfo }) {
  const { t } = useT();
  const L = t.list;
  const marks = crossMarks(info);
  const label = { golden: L.crossGolden, golden_soon: L.crossGoldenSoon, dead: L.crossDead, dead_soon: L.crossDeadSoon };
  return (
    <>
      {marks.map((m) => {
        const up = m.kind.startsWith("golden");
        return (
          <span key={`${m.kind}-${m.tf}`} className={`badge ${up ? "badge--good" : "badge--bad"}`}>
            {up ? "▲" : "▼"} {label[m.kind]} · {t.common.tf[m.tf === "daily" ? "Daily" : m.tf === "weekly" ? "Weekly" : "Monthly"]}
            {m.gap != null ? ` ${pct(m.gap)}` : ""}
          </span>
        );
      })}
      {info.golden && <span className="badge badge--held">{L.crossPt} #{info.golden.rank + 1}</span>}
      {info.vol_ratio != null && (
        <span className="chip" title={L.volHelp}
          style={info.vol_ratio >= HOT_VOLUME ? { color: "var(--accent)", borderColor: "var(--accent)", fontWeight: 600 } : undefined}>
          {L.vol(num(info.vol_ratio, 1))}
        </span>
      )}
      {info.insider?.signal && (
        <span className="chip">
          {t.list.insider} <InsiderBadge insider={info.insider} />
        </span>
      )}
      <SecFlagChips flags={info.sec_flags} />
      <ShortChips info={info} />
    </>
  );
}

/** 차트 카드 머리 아래 한 줄 요약. */
export function StockChips({ info }: { info: TickerInfo }) {
  const { lang, t } = useT();
  const soon = info.days_to_earnings != null && info.days_to_earnings >= 0 && info.days_to_earnings <= 14;
  return (
    <>
      <div className="chart-meta">
        {info.verdict && <span className="chip">{term(lang, info.verdict)}</span>}
        <span className="chip">
          {info.strategy ? term(lang, info.strategy) : t.charts.noStrategy}{" "}
          <span className="num" style={{ fontWeight: 600, color: "var(--ink)" }}>★ {info.score?.toFixed(1) ?? "—"}</span>
        </span>
        {info.health && (
          <span className={`badge badge--${gradeTone(info.health.grade)}`}>{t.charts.healthChip(info.health.score, info.health.grade)}</span>
        )}
        <span className="chip">
          RSI{" "}
          <span className="num" style={{ fontWeight: 600, color: (info.rsi ?? 0) >= 70 ? "var(--warn)" : "var(--ink)" }}>
            {info.rsi?.toFixed(0) ?? "—"}
          </span>
        </span>
        <span className="chip">
          {t.charts.d20} <span className={`num ${tone(info.ret_20d)}`} style={{ fontWeight: 600 }}>{pct(info.ret_20d)}</span>
        </span>
        <span className="chip" style={soon ? { color: "var(--warn)", borderColor: "var(--warn)" } : undefined}>
          {t.charts.earnings} {info.earnings_date ? fmtDate(info.earnings_date, lang) : t.common.tbd}
          {info.days_to_earnings != null && info.earnings_date ? ` ${t.common.inDays(info.days_to_earnings)}` : ""}
        </span>
        {info.market_cap && <span className="chip">{t.common.marketCap(info.market_cap)}</span>}
        <SignalChips info={info} />
      </div>
      <div className="small" style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: "2px 18px", color: "var(--ink-2)" }}>
        <span>
          <span className="muted">{t.common.dailyPatterns}</span> {info.patterns.daily.map((p) => term(lang, p)).join(" · ") || "—"}
        </span>
        <span>
          <span className="muted">{t.common.weeklyPatterns}</span> {info.patterns.weekly.map((p) => term(lang, p)).join(" · ") || "—"}
        </span>
        {info.patterns.monthly.length > 0 && (
          <span>
            <span className="muted">{t.common.monthlyPatterns}</span> {info.patterns.monthly.map((p) => term(lang, p)).join(" · ")}
          </span>
        )}
      </div>
    </>
  );
}
