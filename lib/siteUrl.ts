/**
 * 사이트 운영 주소 — 링크 미리보기 그림 · 검색용 sitemap.xml · robots.txt 의 기준 (2026-11-25 app/layout.tsx 에서 뺐다).
 * Vercel 운영 주소가 있으면 그것, 없으면(로컬) seancho.vercel.app.
 */
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://seancho.vercel.app";

/** 로그인한 관리자만 의미 있는 화면 — 검색에 안 올린다 (각 페이지 metadata 의 robots). */
export const NO_INDEX = { index: false, follow: false } as const;

/**
 * /quant 검색 노출 스위치 (2026-11-25). 같은 날 11:48 ET 에 켰다가(1de4a83) 12:43 ET 에 껐다 — 사용자: "그냥 검색노출 끄자 일단"
 * (데이터 약관 걱정 — Yahoo 는 개인용 전용 · TV 자동 캡처 등, docs/commercial_service_plan.md).
 * false = /quant 전체 noindex (app/quant/layout.tsx) · sitemap.xml 빈 목록 · robots.txt 에 sitemap 줄 없음.
 * true 로 바꾸면 셋 다 다시 켜진다 (그때 lib/visits.ts 의 QUANT_NOINDEX_AT 도 확인).
 * robots.txt 로 /quant 를 막지는 않는다 — 구글이 다시 읽어 noindex 를 봐야 이미 올라간 페이지가 빠진다.
 */
export const QUANT_INDEXABLE = false;
