// 홈 화면 내용 — 이 파일만 고치면 된다. 글은 한국어(ko)·영어(en) 둘 다 적는다.

import type { Lang } from "@/lib/i18n";

type Text = Record<Lang, string>;
export type Project = { title: Text; description: Text; href: string; tag?: Text };

export const profile = {
  name: "SC", // 브라우저 탭 제목·머리글 왼쪽 위
  // 링크 미리보기 (2026-11-19) — 링크드인 · 카카오톡 · 슬랙 등에 주소를 붙였을 때 나오는 제목 · 설명 (app/layout.tsx).
  // 미리보기 그림은 app/opengraph-image.tsx (영어 한 장). 링크드인은 한 번 읽은 미리보기를 한동안 기억한다 — 고친 뒤엔
  // https://www.linkedin.com/post-inspector/ 에 주소를 넣으면 새로 읽는다.
  share: {
    siteName: "SC · Quant",
    title: {
      ko: "퀀트 대시보드 — 미국·캐나다 주식 스크리너 · 페이퍼 트레이딩",
      en: "Quant Dashboard — US & Canada stock screener and paper trading",
    },
    description: {
      ko: "직접 만들어 매일 돌아가는 퀀트 시스템 — 밤마다 미국·캐나다 7,000여 종목 분석, 장중 15분마다 가격 갱신, 페이퍼 트레이딩(PT-1)과 DCF 가치 모델. Python · GitHub Actions · Next.js.",
      en: "A self-built quant system that runs every day: a nightly pipeline scans 7,000+ US and Canadian stocks, prices refresh every 15 minutes in market hours, and paper trading (PT-1) and a DCF value model run on top. Python · GitHub Actions · Next.js.",
    },
  },
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
