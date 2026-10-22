"use client";

import { Fragment } from "react";
import { InsiderBadge } from "./InsiderBadge";
import { useT } from "./LangProvider";
import { SecFlagChips } from "./SecFlags";
import { ShortChips } from "./SqueezePanel";
import { fmtDate, num, openinsiderUrl, pct } from "@/lib/format";
import { term, type Dict, type Lang } from "@/lib/i18n";
import {
  crossMarks,
  ISB_UP,
  isbMarks,
  patternTrend,
  SQZ_DIRS,
  SQZ_TFS,
  sqzFadeWarn,
  sqzFading,
  sqzPhase,
  sqzPickTfs,
  sqzState,
  sqzUp,
  type SqzPick,
} from "@/lib/stockList";
import type { SqzColor, SqzDot, SqzState, SqzTf, TickerInfo } from "@/lib/types";

const HOT_VOLUME = 1.5; // 20일 평균의 1.5배 넘으면 강조

/** 크로스(봉·이동평균 간격) · PT 골든크로스 · 거래량 · 내부자 — 후보·차트 페이지 공통. */
export function SignalChips({ ticker, info }: { ticker: string; info: TickerInfo }) {
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
      {/* 내부자는 늘 보인다 — 거래 없음·조회 안 함('정보 없음')도 구분해서. 누르면 openinsider 회사 페이지 (새 탭) */}
      <a className="chip chip--wrap chip--link" href={openinsiderUrl(ticker)} target="_blank" rel="noopener noreferrer"
        title={info.insider ? t.insider.openHelp : `${t.insider.noneHelp}\n${t.insider.openHelp}`}>
        {t.insider.col} <InsiderBadge insider={info.insider} full /> <span aria-hidden="true">↗</span>
      </a>
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

/* ── SQZ 모멘텀 (TradingView Squeeze Momentum [LazyBear]) ──────────────────────────────────────────
   상태(점: 압축 중 · 발사) + 방향(막대: ▲ 0 위 · ▼ 0 아래, 세지는 중 · 힘 빠짐)을 말로 쓴다.
   차트 색(검은·회색 십자, 연두·초록·빨강·갈색 막대)은 TradingView 와 맞춰 보라고 작은 점·막대로만 남긴다. */

type L10n = Dict["list"];

function SqzDotMark({ dot }: { dot: SqzDot }) {
  return <span className={`sqz-dot sqz-dot--${dot}`} aria-hidden="true" />;
}

function SqzBarMark({ color }: { color: SqzColor }) {
  return color ? <span className={`sqz-bar sqz-bar--${color}`} aria-hidden="true" /> : null;
}

function signed(v: number | null): string {
  return v == null ? "—" : `${v > 0 ? "+" : ""}${num(v, 2)}`;
}

/** 풀린 쪽 — 풀린 봉 막대가 0 위면 ⤴ 위로, 아니면 ⤵ 아래로. */
function firedUp(s: SqzState): boolean {
  return sqzUp(s.fire?.color ?? s.color);
}

/** 상태 한 마디 — '압축 12봉째' · '위로 발사 — 1봉 전 (35봉 압축 후)' · '압축 아님'. */
function phaseLine(s: SqzState, L: L10n): string {
  const p = sqzPhase(s);
  if (p === "on") return L.sqzRunNow(s.run);
  if (p === "fire" && s.fire) return L.sqzReleased(firedUp(s) ? L.sqzRelUp : L.sqzRelDown, s.fire.run, L.sqzAgo(s.fire.ago));
  return L.sqzPhase.off;
}

/** 방향 한 마디 — '▲ 상승 힘 빠짐 2봉째 ⚠'. run 이 없으면(진행 중 봉·옛 데이터) 몇 봉째는 뺀다. */
function dirLine(color: SqzColor, run: number | undefined, L: L10n, warn = false): string {
  if (!color) return "—";
  return `${sqzUp(color) ? "▲" : "▼"} ${L.sqzDir[color]}${run != null ? ` ${L.sqzBars(run)}` : ""}${warn ? " ⚠" : ""}`;
}

/** 마우스를 올리면 뜨는 설명 — 상태 · 방향 · 차트 색과 막대 값 · 끝난 봉 날짜 · 진행 중 봉 · ⚠ 뜻 · 표시 전용 안내. */
export function sqzTitle(s: SqzState, tf: SqzTf, t: Dict, lang: Lang): string {
  const L = t.list;
  const lines = [
    `${L.sqzTfLong[tf]} · ${phaseLine(s, L)} · ${dirLine(s.color, s.color_run, L, sqzFadeWarn(s))}`,
    `${L.sqzChart(L.sqzColor[s.color], signed(s.val))} · ${L.sqzClosed(fmtDate(s.date, lang))}`,
  ];
  if (s.live) {
    const livePhase = s.live.dot === "black" ? L.sqzPhase.on : L.sqzPhase.off;
    lines.push(`${L.sqzLive(fmtDate(s.live.date, lang))}: ${livePhase} · ${dirLine(s.live.color, undefined, L)} (${signed(s.live.val)})`);
  }
  if (sqzFadeWarn(s)) lines.push(L.sqzFadeHelp);
  lines.push(L.sqzNote);
  return lines.join("\n");
}

/** 배지·칩 안쪽 한 줄 — [주] ● 압축 12봉째 · ▮ ▲ 상승 힘 빠짐 2봉째 ⚠ (몇 봉째는 힘 빠짐일 때만). */
function SqzSummary({ s, tf }: { s: SqzState; tf: SqzTf }) {
  const { t } = useT();
  const L = t.list;
  const p = sqzPhase(s);
  const up = sqzUp(s.color);
  return (
    <>
      <span className="sqz-badge__tf">{L.sqzTf[tf]}</span>
      {p === "on" && (
        <>
          <SqzDotMark dot="black" />
          <span>{L.sqzRunNow(s.run)}</span>
        </>
      )}
      {p === "fire" && s.fire && (
        <>
          <span className={firedUp(s) ? "up" : "down"} aria-hidden="true">{firedUp(s) ? "⤴" : "⤵"}</span>
          <span>{firedUp(s) ? L.sqzRelUp : L.sqzRelDown}</span>
          {s.fire.ago > 0 && <span className="sqz-badge__ago">{L.sqzAgo(s.fire.ago)}</span>}
        </>
      )}
      {p !== "off" && s.color && <span className="sqz-badge__sep" aria-hidden="true">·</span>}
      {s.color && (
        <>
          <SqzBarMark color={s.color} />
          <span className={up ? "up" : "down"} aria-hidden="true">{up ? "▲" : "▼"}</span>
          <span>{L.sqzDir[s.color]}</span>
          {sqzFading(s.color) && s.color_run != null && <span className="num">{L.sqzBars(s.color_run)}</span>}
          {sqzFadeWarn(s) && <span className="sqz-badge__warn">⚠</span>}
        </>
      )}
    </>
  );
}

/**
 * 목록 배지 — 고른 봉 하나 ('모두'면 일·주·월 셋).
 * 평소엔 압축 중·발사인 봉만, SQZ 필터·정렬을 쓰는 중이면(always) 모든 종목에 (방향을 보려고).
 * 발사: 마지막 봉이면 강조 테두리, 1~2봉 전이면 점선.
 */
export function SqzBadge({ info, pick, always }: { info: TickerInfo | null; pick: SqzPick; always: boolean }) {
  const { lang, t } = useT();
  return (
    <>
      {sqzPickTfs(pick).map((tf) => {
        const s = sqzState(info, tf);
        if (!s || (!always && sqzPhase(s) === "off")) return null;
        const fire = sqzPhase(s) === "fire" ? s.fire : undefined;
        const cls = !fire ? "sqz-badge" : fire.ago === 0 ? "sqz-badge sqz-badge--fire" : "sqz-badge sqz-badge--old";
        return (
          <span key={tf} className={cls} title={sqzTitle(s, tf, t, lang)}>
            <SqzSummary s={s} tf={tf} />
          </span>
        );
      })}
    </>
  );
}

/** 상세 칩 — 일·주·월 세 개 (목록 배지와 같은 말, 늘 방향까지). */
function SqzChips({ info }: { info: TickerInfo }) {
  const { lang, t } = useT();
  if (!info.sqzmom) return null;
  return (
    <>
      {SQZ_TFS.map((tf) => {
        const s = sqzState(info, tf);
        if (!s) return null;
        return (
          <span key={tf} className="sqz-badge sqz-badge--chip" title={sqzTitle(s, tf, t, lang)}>
            <span className="sqz-badge__tf">SQZ</span>
            <SqzSummary s={s} tf={tf} />
          </span>
        );
      })}
    </>
  );
}

/** 세 봉이 같은 상태(압축 중·발사) 또는 같은 방향이면 한 마디씩 — '일·주·월 모두 압축 중'. */
function sqzAligned(states: (SqzState | null)[], L: L10n): string[] {
  if (states.length < 3 || states.some((s) => !s)) return [];
  const ss = states as SqzState[];
  const out: string[] = [];
  const p = sqzPhase(ss[0]);
  if (p !== "off" && ss.every((s) => sqzPhase(s) === p)) out.push(L.sqzAligned(L.sqzPhase[p]));
  const c = ss[0].color;
  if (c && ss.every((s) => s.color === c)) out.push(L.sqzAligned(`${sqzUp(c) ? "▲" : "▼"} ${L.sqzDir[c]}`));
  return out;
}

/** 종목 상세 페이지 — 봉마다 상태 · 방향 두 줄 + 끝난 봉·진행 중 봉, 세 봉이 맞으면 한 마디, 그 아래 읽는 법. */
export function SqzRows({ info }: { info: TickerInfo }) {
  const { lang, t } = useT();
  const L = t.list;
  const states = SQZ_TFS.map((tf) => sqzState(info, tf));
  const aligned = sqzAligned(states, L);
  return (
    <>
      <dl className="stats">
        {SQZ_TFS.map((tf, k) => {
          const s = states[k];
          return (
            <div key={tf} className="stat">
              <dt>{L.sqzTfLong[tf]}</dt>
              <dd title={s ? sqzTitle(s, tf, t, lang) : undefined}>
                {!s ? "—" : (
                  <>
                    <span className="sqz-line">
                      {sqzPhase(s) === "on" && <SqzDotMark dot="black" />}
                      {sqzPhase(s) === "fire" && (
                        <span className={`sqz-arrow ${firedUp(s) ? "up" : "down"}`} aria-hidden="true">{firedUp(s) ? "⤴" : "⤵"}</span>
                      )}
                      {phaseLine(s, L)}
                    </span>
                    <span className="sqz-line">
                      <SqzBarMark color={s.color} />
                      <span className={sqzUp(s.color) ? "up" : "down"}>{dirLine(s.color, s.color_run, L, sqzFadeWarn(s))}</span>
                    </span>
                    <span className="sqz-line tiny muted">
                      {L.sqzChart(L.sqzColor[s.color], signed(s.val))} · {L.sqzClosed(fmtDate(s.date, lang))}
                    </span>
                    {s.live && (
                      <span className="sqz-line tiny muted">
                        {L.sqzLive(fmtDate(s.live.date, lang))}: {s.live.dot === "black" ? L.sqzPhase.on : L.sqzPhase.off}
                        {" · "}{dirLine(s.live.color, undefined, L)} ({signed(s.live.val)})
                      </span>
                    )}
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {aligned.length > 0 && (
        <p className="sqz-aligned">
          {aligned.map((a) => <span key={a} className="chip">{a}</span>)}
        </p>
      )}
      <p className="tiny muted sqz-legend">
        <strong>{L.sqzLegend}</strong>
        <span><SqzDotMark dot="black" /> {L.sqzLegendDots.on}</span>
        <span><SqzDotMark dot="gray" /> {L.sqzLegendDots.fire}</span>
        {SQZ_DIRS.map((d) => (
          <span key={d}>
            <SqzBarMark color={d} /> {L.sqzColor[d]} = <span className={sqzUp(d) ? "up" : "down"}>{sqzUp(d) ? "▲" : "▼"}</span> {L.sqzDir[d]}
          </span>
        ))}
        <span>{L.sqzFadeHelp}</span>
      </p>
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
