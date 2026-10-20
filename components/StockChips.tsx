"use client";

import { Fragment } from "react";
import { InsiderBadge } from "./InsiderBadge";
import { useT } from "./LangProvider";
import { SecFlagChips } from "./SecFlags";
import { ShortChips } from "./SqueezePanel";
import { num, pct } from "@/lib/format";
import { term } from "@/lib/i18n";
import { crossMarks, patternTrend } from "@/lib/stockList";
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

/** 패턴 이름 + 방향 — ▲ 상승(초록) · ▼ 하락(빨강) · ◆ 중립(도지·대칭삼각형, 회색 표시만). 골든·데드크로스 버튼과 같은 모양. */
export function PatternName({ name }: { name: string }) {
  const { lang } = useT();
  const trend = patternTrend(name);
  if (trend === "neutral") {
    return (
      <span>
        <span className="pat-neutral" aria-hidden="true">◆</span> {term(lang, name)}
      </span>
    );
  }
  return <span className={trend}>{trend === "up" ? "▲" : "▼"} {term(lang, name)}</span>;
}

/** 패턴 여러 개를 ' · ' 로 (없으면 —). */
export function PatternList({ list }: { list: string[] }) {
  if (list.length === 0) return <>—</>;
  return (
    <>
      {list.map((p, i) => (
        <Fragment key={p}>
          {i > 0 && " · "}
          <PatternName name={p} />
        </Fragment>
      ))}
    </>
  );
}
