import { cookies } from "next/headers";
import { DICTS, isLang, LANG_COOKIE, type Dict, type Lang } from "./i18n";

/** 서버 컴포넌트에서 지금 언어 — 쿠키 'lang' (없으면 한국어). */
export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "ko";
}

/** 서버 컴포넌트에서 { lang, t } — t 는 그 언어의 문구 묶음. */
export async function getT(): Promise<{ lang: Lang; t: Dict }> {
  const lang = await getLang();
  return { lang, t: DICTS[lang] };
}
