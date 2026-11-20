import { cookies, headers } from "next/headers";
import { DICTS, isLang, LANG_COOKIE, type Dict, type Lang } from "./i18n";

/**
 * 브라우저가 보낸 Accept-Language 에 한국어(ko, ko-KR …)가 하나라도 있으면 true.
 * 첫째 언어만 보지 않는다 — 영어를 첫째로 둔 한국어 사용자도 한국어로 열리게. q=0 (그 언어는 싫다) 은 뺀다.
 */
export function wantsKorean(acceptLanguage: string | null): boolean {
  return (acceptLanguage ?? "").split(",").some((part) => {
    const [tag, ...params] = part.trim().toLowerCase().split(";");
    if (tag !== "ko" && !tag.startsWith("ko-")) return false;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    return !q || Number(q.slice(2)) > 0;
  });
}

/**
 * 서버 컴포넌트에서 지금 언어 — 쿠키 'lang' 이 먼저 (KO|EN 버튼 · '?lang=en' 링크 → proxy.ts).
 * 쿠키가 없는 첫 방문은 브라우저 언어로 (2026-11-19): 한국어가 있으면 한국어, 없으면 영어 —
 * 링크드인 · 이력서 링크로 들어온 영어권 방문자가 처음부터 영어 화면을 보게. 그 전엔 언제나 한국어였다.
 */
export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(v)) return v;
  return wantsKorean((await headers()).get("accept-language")) ? "ko" : "en";
}

/** 서버 컴포넌트에서 { lang, t } — t 는 그 언어의 문구 묶음. */
export async function getT(): Promise<{ lang: Lang; t: Dict }> {
  const lang = await getLang();
  return { lang, t: DICTS[lang] };
}
