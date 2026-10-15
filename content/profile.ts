// 홈 화면 내용 — 이 파일만 고치면 된다.

export type ProfileLink = { label: string; href: string };
export type Project = { title: string; description: string; href: string; tag?: string };

export const profile = {
  name: "[이름]",
  intro: "[한두 줄 소개를 적어 주세요. 예: 미국 주식 퀀트 시스템을 만들고 있습니다.]",
  links: [{ label: "GitHub", href: "https://github.com/sean-ccho" }] as ProfileLink[],
  projects: [
    {
      title: "퀀트 대시보드",
      description: "PT-1 페이퍼 트레이딩 보유 종목·매도선, 스크리너 매수 후보, 매일 찍는 TradingView 차트.",
      href: "/quant",
      tag: "매일 갱신",
    },
  ] as Project[],
};
