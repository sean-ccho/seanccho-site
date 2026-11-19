/**
 * 예측 모델 문서 탭의 리서치 정리 목차 (ValueModelGuide 의 절 id · 이름). 서버 페이지(app/quant/model)가 목차를 그릴 때 부른다 —
 * "use client" 파일(ValueModelGuide)에 두면 서버에서 함수로 부를 수 없어 문서 탭이 500 이 났다 (2026-11-19, 한/영 전환 6e3a4a8 부터).
 */

export const GUIDE_SECTIONS = [
  { id: "vm-1", label: "1 리서치 개요" },
  { id: "vm-2", label: "2 로직 한눈에" },
  { id: "vm-3", label: "3 시장 타이밍" },
  { id: "vm-4", label: "4 가치주 스크린" },
  { id: "vm-5", label: "5 Fiserv형 리서치" },
  { id: "vm-6", label: "6 특수상황" },
  { id: "vm-7", label: "7 문제점" },
  { id: "vm-8", label: "8 성과 검증" },
] as const;

const GUIDE_SECTIONS_EN = [
  { id: "vm-1", label: "1 Research overview" },
  { id: "vm-2", label: "2 Logic at a glance" },
  { id: "vm-3", label: "3 Market timing" },
  { id: "vm-4", label: "4 Value screen" },
  { id: "vm-5", label: "5 Fiserv-style research" },
  { id: "vm-6", label: "6 Special situations" },
  { id: "vm-7", label: "7 Problems" },
  { id: "vm-8", label: "8 Performance check" },
] as const;

/** Language-aware section list (for the page's in-page nav). GUIDE_SECTIONS stays ko. */
export function guideSections(lang: string): readonly { id: string; label: string }[] {
  return lang === "en" ? GUIDE_SECTIONS_EN : GUIDE_SECTIONS;
}
