// 언어 코드 · 쿠키 이름만 (2026-11-19) — proxy.ts 가 큰 문구 파일(i18n.ts) 없이 쓰려고 따로 뺐다. i18n.ts 가 다시 내보낸다.

export type Lang = "ko" | "en";
export const LANG_COOKIE = "lang";

export function isLang(v: unknown): v is Lang {
  return v === "ko" || v === "en";
}
