"use client";

import { useKoFallback } from "@/lib/mtBrowser";
import type { NewsItem } from "@/lib/news";

/**
 * 기사 제목 링크 + (번역됐으면) 원문 줄 — NewsLine(종목 · PT-1 · 내계좌 뉴스)이 쓴다.
 * 서버 번역이 빠진 제목은 브라우저가 채운다 (lib/mtBrowser.ts, 2026-11-10).
 */
export function NewsTitle({ item }: { item: Pick<NewsItem, "title" | "ko" | "mt" | "url"> }) {
  const ko = useKoFallback([item])(item);
  return (
    <>
      <a className="news-link" href={item.url} target="_blank" rel="noopener noreferrer">
        {ko ?? item.title}
      </a>
      {ko && <span className="news-en">{item.title}</span>}
    </>
  );
}
