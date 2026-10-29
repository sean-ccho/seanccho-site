import type { Lang } from "./i18n";
import { translateKo } from "./translate";
import { getUniverseAbout } from "./universeServer";

// 회사 소개 (2026-10-28) — Project_1 전체분석이 yfinance 회사 소개(영어)를 종목 파일(stocks/{티커}.json)에 싣는다.
// 한국어 화면은 문장마다 구글 기계번역을 붙인다 (lib/translate.ts — 하루 캐시, 막히면 원문만).

export type About = {
  en: string;
  /** 문장마다 번역해 이은 것 — EN 화면·번역 실패면 null */
  ko: string | null;
};

// 문장 끝처럼 보여도 끊지 않는 줄임말 ('Inc. and' 는 뒤가 소문자라 원래 안 끊긴다)
const ABBR = /(?:\b[A-Z]\.){2,}$|\b(?:Inc|Corp|Co|Ltd|Bros|No|St|Mr|Mrs|Ms|Dr|Jr|Sr|vs|approx|Mt|Ft|Intl)\.$/;

/** 영어 소개 → 문장 목록. 'U.S.' · 'Inc.' 같은 줄임말 뒤에서는 끊지 않는다. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  for (const piece of text.trim().split(/(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/)) {
    const last = out.at(-1);
    if (last && ABBR.test(last)) out[out.length - 1] = `${last} ${piece}`;
    else out.push(piece);
  }
  return out.filter(Boolean);
}

/** 종목의 회사 소개. 소개가 없으면 null. 절대 throw 하지 않는다. */
export async function getAbout(ticker: string, lang: Lang): Promise<About | null> {
  const en = await getUniverseAbout(ticker);
  if (!en) return null;
  if (lang !== "ko") return { en, ko: null };
  const ko = await translateKo(sentences(en));
  return { en, ko: ko ? ko.join(" ") : null };
}
