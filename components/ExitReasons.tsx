import { pct } from "@/lib/format";
import { DICTS, term, type Lang } from "@/lib/i18n";
import type { TradeSummary } from "@/lib/types";

/** 청산 이유별 평균 수익률 — 가운데 0, 왼쪽 손실·오른쪽 이익, 값은 모두 직접 표시. */
export function ExitReasons({ trades, lang }: { trades: TradeSummary; lang: Lang }) {
  const t = DICTS[lang];
  const rows = trades.by_reason;
  if (rows.length === 0) return <p className="muted">{t.reasons.none}</p>;
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.avg_return))) || 1;
  return (
    <figure style={{ margin: 0 }}>
      <div className="reasons">
        {rows.map((r) => {
          const w = `${(Math.abs(r.avg_return) / maxAbs) * 100}%`;
          return (
            <div key={r.reason} className="reason">
              <span style={{ fontWeight: 500 }}>{term(lang, r.reason)}</span>
              <span className="num small muted">{t.common.count(r.count)}</span>
              <div className="reason__bars" aria-hidden="true">
                <div className="reason__half reason__half--neg">
                  {r.avg_return < 0 && <div className="reason__bar reason__bar--neg" style={{ width: w }} />}
                </div>
                <div className="reason__half">
                  {r.avg_return > 0 && <div className="reason__bar reason__bar--pos" style={{ width: w }} />}
                </div>
              </div>
              <span className="num" style={{ textAlign: "right", fontWeight: 600 }}>
                {pct(r.avg_return)}
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="tiny muted" style={{ marginTop: 14 }}>
        {t.reasons.caption(trades.count)}
      </figcaption>
    </figure>
  );
}
