"use client";

import { useT } from "./LangProvider";

/** 접고 펴는 칸(<details>) 머리 맨 오른쪽 '펼치기 / 접기' — 화살표(⌄)는 CSS 가 summary 끝에 붙인다. */
export function PanelHint() {
  const { t } = useT();
  return (
    <span className="panel-hint" aria-hidden="true">
      <span className="panel-hint__closed">{t.screen.open}</span>
      <span className="panel-hint__open">{t.screen.close}</span>
    </span>
  );
}
