"use client";

import { CHART_MODES, STUDIES, useChartPrefs } from "./ChartPrefs";
import { useT } from "./LangProvider";

/**
 * '캡처 / 실시간 / 같이' 전환 (전체분석처럼 실시간 고정인 화면에서는 안 보인다).
 * compact = 이름 없이 버튼만 (멀티차트 머리처럼 좁은 자리 — 묶음 이름은 aria-label 로).
 */
export function ChartModeSeg({ compact = false }: { compact?: boolean }) {
  const { t } = useT();
  const { mode, forced, setMode } = useChartPrefs();
  if (forced) return null;
  const L = t.charts;
  const label = { shot: L.modeShot, live: L.modeLive, both: L.modeBoth } as const;
  const help = { shot: L.modeShotHelp, live: L.modeLiveHelp, both: L.modeBothHelp } as const;
  const seg = (
    <div className="tseg" role={compact ? "group" : undefined} aria-label={compact ? L.mode : undefined}>
      {CHART_MODES.map((m) => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} title={help[m]}>
          {label[m]}
        </button>
      ))}
    </div>
  );
  if (compact) return seg;
  return (
    <div className="ctl-group" role="group" aria-label={L.mode}>
      <span className="ctl-group__label">{L.mode}</span>
      {seg}
    </div>
  );
}

/** 실시간 차트에 미리 켜 둘 지표 (여러 개). 캡처만 볼 때는 안 보인다 (live = 캡처가 없어 늘 실시간인 차트). */
export function StudyChips({ live = false }: { live?: boolean }) {
  const { t } = useT();
  const { mode, studies, toggleStudy } = useChartPrefs();
  if (mode === "shot" && !live) return null;
  const L = t.charts;
  return (
    <div className="ctl-group" role="group" aria-label={L.studies}>
      <span className="ctl-group__label" title={L.studiesHelp}>{L.studies}</span>
      <div className="tseg">
        {STUDIES.map((s) => (
          <button key={s} type="button" aria-pressed={studies.includes(s)} onClick={() => toggleStudy(s)}>
            {studies.includes(s) && (
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12 L10 17 L19 7" />
              </svg>
            )}
            {L.study[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
