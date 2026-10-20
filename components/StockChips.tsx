"use client";

import { Fragment } from "react";
import { InsiderBadge } from "./InsiderBadge";
import { useT } from "./LangProvider";
import { SecFlagChips } from "./SecFlags";
import { ShortChips } from "./SqueezePanel";
import { fmtDate, num, pct } from "@/lib/format";
import { term, type Dict, type Lang } from "@/lib/i18n";
import { crossMarks, ISB_UP, isbMarks, patternTrend, SQZ_TFS, sqzBadge, sqzState } from "@/lib/stockList";
import type { SqzColor, SqzDot, SqzState, SqzTf, TickerInfo } from "@/lib/types";

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
      <IsbChips info={info} />
      <SqzChips info={info} />
      {info.vol_ratio != null && (
        <span className="chip" title={L.volHelp}
          style={info.vol_ratio >= HOT_VOLUME ? { color: "var(--accent)", borderColor: "var(--accent)", fontWeight: 600 } : undefined}>
          {L.vol(num(info.vol_ratio, 1))}
        </span>
      )}
      {/* 내부자는 늘 보인다 — 거래 없음·조회 안 함('정보 없음')도 구분해서 */}
      <span className="chip chip--wrap" title={info.insider ? undefined : t.insider.noneHelp}>
        {t.insider.col} <InsiderBadge insider={info.insider} full />
      </span>
      <SecFlagChips flags={info.sec_flags} />
      <ShortChips info={info} />
    </>
  );
}

/** ISB 차트 라벨 (BUY·REV · ◇ BOTTOM · ◆ TOP · EXIT) — 최근 몇 달 안에 찍힌 것만, 라벨마다 일봉·주봉 중 더 최근 것. */
function IsbChips({ info }: { info: TickerInfo }) {
  const { lang, t } = useT();
  const L = t.list;
  return (
    <>
      {isbMarks(info).map((m) => (
        <span key={m.label} className={`badge ${ISB_UP[m.label] ? "badge--good" : "badge--bad"}`}
          title={`${L.isbHelp[m.label]}\n${L.isbNote}`}>
          {L.sorts[`isb_${m.label}`]} · {L.isbTfLong[m.tf]} {fmtDate(m.date, lang)} ({L.isbAgo(m.ago)})
        </span>
      ))}
    </>
  );
}

/* ── SQZ 모멘텀 (TradingView Squeeze Momentum [LazyBear]) — 차트와 같은 색: 십자 검정·회색, 막대 연두·초록·빨강·갈색 ── */

function SqzDotMark({ dot }: { dot: SqzDot }) {
  return <span className={`sqz-dot sqz-dot--${dot}`} aria-hidden="true" />;
}

function SqzBarMark({ color }: { color: SqzColor }) {
  return color ? <span className={`sqz-bar sqz-bar--${color}`} aria-hidden="true" /> : null;
}

function signed(v: number | null): string {
  return v == null ? "—" : `${v > 0 ? "+" : ""}${num(v, 2)}`;
}

/** 마우스를 올리면 뜨는 설명 — 십자 상태 · 막대 · 끝난 봉 날짜 · 진행 중 봉 · 표시 전용 안내. */
export function sqzTitle(s: SqzState, tf: SqzTf, t: Dict, lang: Lang): string {
  const L = t.list;
  const state = s.fire
    ? L.sqzReleased(s.fire.run, L.sqzWhen(s.fire.ago))
    : s.dot === "black"
      ? L.sqzRunNow(s.run) + (s.lime ? ` · ${L.sqzLimeTurn(L.sqzWhen(s.lime.ago))}` : "")
      : L.sqzDot[s.dot];
  const lines = [
    `${L.sqzTfLong[tf]} · ${state} · ${L.sqzBarText(L.sqzColor[s.color], signed(s.val))} (${L.sqzClosed(fmtDate(s.date, lang))})`,
  ];
  if (s.live) {
    lines.push(`${L.sqzLive(fmtDate(s.live.date, lang))}: ${L.sqzDot[s.live.dot]} · ${L.sqzBarText(L.sqzColor[s.live.color], signed(s.live.val))}`);
  }
  lines.push(L.sqzNote);
  return lines.join("\n");
}

/**
 * 목록 배지 — 고른 봉(기본 주봉) 하나만. 평소엔 없음.
 * 눌림 중 [주 ●12 ▮] · 눌린 채 연두 [주 ●5 ▮↑] · 이번 봉 풀림 [주 ●12→○ 풀림 ▮] (강조) · 1~2봉 전 풀림 [주 풀림 2봉 전 ▮] (흐리게).
 */
export function SqzBadge({ info, tf }: { info: TickerInfo | null; tf: SqzTf }) {
  const { lang, t } = useT();
  const L = t.list;
  const b = sqzBadge(info, tf);
  if (!b) return null;
  const s = b.state;
  const cls = b.kind === "fire" ? "sqz-badge sqz-badge--fire" : b.kind === "fire_old" ? "sqz-badge sqz-badge--old" : "sqz-badge";
  return (
    <span className={cls} title={sqzTitle(s, tf, t, lang)}>
      <span className="sqz-badge__tf">{L.sqzTf[tf]}</span>
      {b.kind === "fire" && s.fire && (
        <>
          <SqzDotMark dot="black" />
          <span className="num">{s.fire.run}</span>→<SqzDotMark dot="gray" />
          <span className="sqz-badge__word">{L.sqzFire}</span>
        </>
      )}
      {b.kind === "fire_old" && s.fire && (
        <span className="sqz-badge__word sqz-badge__word--keep">{L.sqzFire} {L.sqzWhen(s.fire.ago)}</span>
      )}
      {b.kind === "on" && (
        <>
          <SqzDotMark dot="black" />
          <span className="num">{s.run}</span>
        </>
      )}
      <SqzBarMark color={s.color} />
      {b.kind === "on" && s.lime && <span className="up" aria-hidden="true">↑</span>}
    </span>
  );
}

/** 상세 칩 — 일·주·월 세 개 (봉 · 십자 · 막대 · 값). */
function SqzChips({ info }: { info: TickerInfo }) {
  const { lang, t } = useT();
  const L = t.list;
  if (!info.sqzmom) return null;
  return (
    <>
      {SQZ_TFS.map((tf) => {
        const s = sqzState(info, tf);
        if (!s) return null;
        return (
          <span key={tf} className="chip" title={sqzTitle(s, tf, t, lang)}>
            SQZ {L.sqzTf[tf]} <SqzDotMark dot={s.dot} />
            {s.dot === "black" && <span className="num">{s.run}</span>}
            {s.fire && <span>{L.sqzFire} {L.sqzWhen(s.fire.ago)}</span>}
            <SqzBarMark color={s.color} /> <span className="num">{signed(s.val)}</span>
          </span>
        );
      })}
    </>
  );
}

/** 종목 상세 페이지 표 — 봉마다 한 줄: 십자 상태 · 막대 · 끝난 봉 · 진행 중 봉. */
export function SqzRows({ info }: { info: TickerInfo }) {
  const { lang, t } = useT();
  const L = t.list;
  return (
    <dl className="stats">
      {SQZ_TFS.map((tf) => {
        const s = sqzState(info, tf);
        return (
          <div key={tf} className="stat">
            <dt>{L.sqzTfLong[tf]}</dt>
            <dd title={s ? sqzTitle(s, tf, t, lang) : undefined}>
              {!s ? "—" : (
                <>
                  <SqzDotMark dot={s.dot} />{" "}
                  {s.fire ? L.sqzReleased(s.fire.run, L.sqzWhen(s.fire.ago)) : s.dot === "black" ? L.sqzRunNow(s.run) : L.sqzDot[s.dot]}
                  {s.lime && !s.fire ? ` · ${L.sqzLimeTurn(L.sqzWhen(s.lime.ago))}` : ""}
                  {" · "}<SqzBarMark color={s.color} /> {L.sqzBarText(L.sqzColor[s.color], signed(s.val))}
                  <span className="tiny muted"> ({L.sqzClosed(fmtDate(s.date, lang))}
                    {s.live ? ` · ${L.sqzLive(fmtDate(s.live.date, lang))} ${L.sqzColor[s.live.color]} ${signed(s.live.val)}` : ""})</span>
                </>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
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
