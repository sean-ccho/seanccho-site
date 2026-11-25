/**
 * 사이트 운영 주소 — 링크 미리보기 그림 · 검색용 sitemap.xml · robots.txt 의 기준 (2026-11-25 app/layout.tsx 에서 뺐다).
 * Vercel 운영 주소가 있으면 그것, 없으면(로컬) seancho.vercel.app.
 */
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://seancho.vercel.app";

/** 로그인한 관리자만 의미 있는 화면 — 검색에 안 올린다 (각 페이지 metadata 의 robots). */
export const NO_INDEX = { index: false, follow: false } as const;
