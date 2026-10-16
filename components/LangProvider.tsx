"use client";

import { createContext, useContext } from "react";
import { DICTS, type Dict, type Lang } from "@/lib/i18n";

const LangContext = createContext<Lang>("ko");

/** 루트 레이아웃이 쿠키에서 읽은 언어를 클라이언트 컴포넌트에 내려 준다. */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext value={lang}>{children}</LangContext>;
}

/** 클라이언트 컴포넌트에서 { lang, t }. */
export function useT(): { lang: Lang; t: Dict } {
  const lang = useContext(LangContext);
  return { lang, t: DICTS[lang] };
}
