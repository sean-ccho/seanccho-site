// 패턴 · 교차 라벨 · 예고에 마우스를 올리면 뜨는 설명 (title). 문구는 lib/i18n.ts, 규칙 숫자는 아래 (Project_1 그대로).
// 서버 페이지(종목 상세)도 쓰므로 클라이언트 컴포넌트 파일이 아닌 여기에 둔다.

import { pct } from "./format";
import { patternHelp, term, type Dict, type Lang } from "./i18n";
import { CROSS_KIND, type BarTf, type CrossKind, type CrossMark } from "./stockList";
import type { GoldenTf } from "./types";

type L10n = Dict["list"];

/**
 * 교차 라벨 규칙 — Project_1 screener/ma_cross.py TF_RULES.
 * win = 교차 라벨이 남는 봉 수 · lag = 임박의 '간격이 좁아짐'을 견주는 몇 봉 전 (slope_lookback − 1) · slope = EMA10 방향도 보는지 (주·월).
 */
export const CROSS_RULES: Record<BarTf, { win: number; lag: number; slope: boolean }> = {
  daily: { win: 5, lag: 9, slope: false },
  weekly: { win: 5, lag: 4, slope: true },
  monthly: { win: 3, lag: 2, slope: true },
};

/**
 * 가격 패턴을 찾는 구간 (봉 수) — Project_1 screener/patterns.py: 일봉 detect_all_patterns (60봉 · 컵 90봉),
 * 주·월봉 detect_weekly_patterns · detect_monthly_patterns (상승 쪽 패턴만 본다).
 */
export const PATTERN_BARS: Record<string, Partial<Record<BarTf, number>>> = {
  대칭삼각형: { daily: 60 },
  상승삼각형: { daily: 60, weekly: 40, monthly: 24 },
  하락삼각형: { daily: 60 },
  상승쐐기: { daily: 60 },
  하락쐐기: { daily: 60, weekly: 40, monthly: 24 },
  이중바닥: { daily: 60, weekly: 52, monthly: 24 },
  이중천장: { daily: 60 },
  헤드앤숄더: { daily: 60 },
  역헤드앤숄더: { daily: 60, weekly: 52, monthly: 24 },
  컵앤핸들: { daily: 90, weekly: 52, monthly: 36 },
};

const TF_KEY = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" } as const;
const CROSS_NAME = { golden: "crossGolden", golden_soon: "crossGoldenSoon", dead: "crossDead", dead_soon: "crossDeadSoon" } as const;

export function tfName(t: Dict, tf: BarTf): string {
  return t.common.tf[TF_KEY[tf]];
}

export function crossName(L: L10n, kind: CrossKind): string {
  return L[CROSS_NAME[kind]];
}

/** 교차 배지 — 뜻 · 지금 간격 · 그 봉의 조건 · 기준 봉 · 차트 바탕. */
export function crossTitle(t: Dict, kind: CrossKind, tf: BarTf, gap?: number | null): string {
  const L = t.list;
  const lines = [`${crossName(L, kind)} · ${tfName(t, tf)} — ${L.crossKind[kind]}`];
  if (gap != null && Number.isFinite(gap) && gap !== 0) lines.push(L.crossGap(pct(Math.abs(gap), 1, false), gap > 0));
  lines.push(L.crossRule(kind, CROSS_RULES[tf]), L.tfBasis[tf]);
  if (tf !== "daily") lines.push(L.previewApart);
  lines.push(L.chartBasis);
  return lines.join("\n");
}

/** 예고 배지 — 이번 주·달 봉이 마지막 종가로 끝나면 바뀌는 라벨 · 지금 끝난 봉 라벨 · 언제 확정 · 표시 전용. */
export function previewTitle(t: Dict, kind: CrossKind, tf: "weekly" | "monthly", now: CrossKind | null): string {
  const L = t.list;
  return [
    `${L.preview} · ${tfName(t, tf)} — ${L.previewWhat(L.previewWhen[tf], crossName(L, kind))}`,
    `${crossName(L, kind)} = ${L.crossKind[kind]}`,
    L.previewNow(now ? crossName(L, now) : t.common.none),
    L.previewSettle[tf],
    L.previewUse,
  ].join("\n");
}

/** 목록 요약 배지 (▲ 골든크로스 · ▼ 데드크로스) — 어느 봉에 무엇이 걸렸는지 한 줄씩. */
export function crossMarksTitle(t: Dict, marks: CrossMark[]): string {
  const L = t.list;
  const lines = marks.map((m) => `${crossName(L, m.kind)} · ${tfName(t, m.tf)}${m.gap != null ? ` ${pct(m.gap)}` : ""} — ${L.crossKind[m.kind]}`);
  return [...lines, L.crossFilterNote].join("\n");
}

/** 'PT 골든크로스 #N' 배지 — 목록 순위 · 걸린 봉 · 들어가는 기준 · 순서. */
export function ptGoldenTitle(t: Dict, g: { rank: number; timeframes: GoldenTf[] }): string {
  const tfs = g.timeframes.map((x) => `${tfName(t, x.tf)} ${pct(x.gap)}`).join(" · ");
  return t.list.ptGoldenHelp(g.rank + 1, tfs || t.common.none);
}

/** 크로스 필터 버튼 — 무엇을 거르는지 + 뜻 + 끝난 봉 기준. */
export function crossFilterTitle(L: L10n, kind: CrossKind | "pt"): string {
  return kind === "pt"
    ? `${L.crossFilterHelp.pt}\n${L.crossFilterNote}`
    : `${L.crossFilterHelp[kind]} — ${L.crossKind[kind]}\n${L.crossFilterNote}`;
}

function spanText(L: L10n, tf: BarTf, n: number): string {
  if (tf === "daily") return L.spanMonths(Math.round(n / 21));
  if (tf === "weekly") return n >= 52 ? L.spanYears(Math.round(n / 52)) : L.spanMonths(Math.round(n / 4.35));
  return n % 12 === 0 ? L.spanYears(n / 12) : L.spanMonths(n);
}

/**
 * 패턴 이름 — 뜻 · 찾는 구간 (봉을 알면 그 봉만, 모르면 봉마다) · 기준 봉 · 차트 바탕. 교차 이름은 crossTitle (봉을 모르면 뜻만).
 * 설명이 없는 이름이면 undefined (마우스 설명 없음).
 */
export function patternTitle(t: Dict, lang: Lang, name: string, tf?: BarTf): string | undefined {
  const L = t.list;
  const kind = CROSS_KIND[name];
  if (kind) return tf ? crossTitle(t, kind, tf) : `${crossName(L, kind)} — ${L.crossKind[kind]}\n${L.chartBasis}`;
  const help = patternHelp(lang, name);
  if (!help) return undefined;
  const lines = [`${term(lang, name)}: ${help}`];
  if (name.startsWith("정배열")) lines.push(L.uptrendNote);
  const bars = PATTERN_BARS[name] ?? {};
  const n = tf ? bars[tf] : undefined;
  if (tf && n) lines.push(L.patternSpan(n, spanText(L, tf, n)));
  if (!tf && Object.keys(bars).length) {
    const parts = (Object.entries(bars) as [BarTf, number][]).map(([k, v]) => L.spanPart(tfName(t, k), v, spanText(L, k, v)));
    lines.push(L.patternSpans(parts.join(" · ")));
  }
  lines.push(tf ? L.tfBasis[tf] : L.patternAnyTf, L.chartBasis);
  return lines.join("\n");
}

/** '일봉 패턴' · '주봉 패턴' · '월봉 패턴' 칸 이름 — 기준 봉 · 예고 · 차트 바탕. */
export function patternRowTitle(t: Dict, tf: BarTf): string {
  const L = t.list;
  return [L.tfBasis[tf], ...(tf !== "daily" ? [L.previewApart] : []), L.chartBasis].join("\n");
}
