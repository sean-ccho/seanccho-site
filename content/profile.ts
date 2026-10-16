// 홈 화면 내용 — 이 파일만 고치면 된다. 글은 한국어(ko)·영어(en) 둘 다 적는다.

import type { Lang } from "@/lib/i18n";

type Text = Record<Lang, string>;
export type Project = { title: Text; description: Text; href: string; tag?: Text };

export const profile = {
  name: "SC", // 브라우저 탭 제목·머리글 왼쪽 위
  projects: [
    {
      title: { ko: "퀀트 대시보드", en: "Quant dashboard" },
      description: {
        ko: "PT-1 페이퍼 트레이딩 보유 종목·매도선, 스크리너 매수 후보, 매일 찍는 TradingView 차트.",
        en: "PT-1 paper trading holdings and exit lines, screener buy candidates, and daily TradingView charts.",
      },
      href: "/quant",
      tag: { ko: "매일 갱신", en: "Daily" },
    },
  ] as Project[],
};
