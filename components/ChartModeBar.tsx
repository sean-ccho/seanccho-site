"use client";

import { STUDIES, useChartPrefs, type ChartMode } from "./ChartPrefs";
import { useT } from "./LangProvider";

const MODES: ChartMode[] = ["shot", "live"];

/** '캡처 / 실시간' 전환 (전체분석처럼 실시간 고정인 화면에서는 안 보인다). */
export function ChartModeSeg() {
  const { t } = useT();
  const { mode, forced, setMode } = useChartPrefs();
  if (forced) return null;
  const L = t.charts;
  return (
    <div className="ctl-group" role="group" aria-label={L.mode}>
      <span className="ctl-group__label">{L.mode}</span>
      <div className="tseg">
        {MODES.map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
            title={m === "live" ? L.modeLiveHelp : L.modeShotHelp}>
            {m === "live" ? L.modeLive : L.modeShot}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 실시간 차트에 미리 켜 둘 지표 (여러 개). 캡처 모드에서는 안 보인다 (live = 캡처가 없어 늘 실시간인 차트). */
export function StudyChips({ live = false }: { live?: boolean }) {
  const { t } = useT();
  const { mode, studies, toggleStudy } = useChartPrefs();
  if (mode !== "live" && !live) return null;
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
