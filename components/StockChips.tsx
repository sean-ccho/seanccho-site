"use client";

import { InsiderBadge } from "./InsiderBadge";
import { useT } from "./LangProvider";
import { SecFlagChips } from "./SecFlags";
import { ShortChips } from "./SqueezePanel";
import { num, pct } from "@/lib/format";
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
