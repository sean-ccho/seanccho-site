import type { Cron } from "./schedule";

/**
 * 관리 탭(/quant/admin)의 작업 목록 (2026-11-04) — Project_1 .github/workflows 의 작업 6개.
 * '하는 일'은 사람이 읽는 설명이고, 단계별 시간은 gh 에 적은 GitHub 단계 이름(steps[].name)으로 실제 실행 기록에서 모은다.
 * 워크플로 단계 이름이 바뀌면 여기 gh 도 바꿔야 그 단계 시간이 '나머지'로 빠지지 않는다.
 * 이 Mac 에서 도는 것(Shadow Track · Account Watch 신호기)은 사이트가 볼 수 없어서 아직 안 넣었다.
 */

export type PipelineStep = {
  label: string;
  desc: string;
  /** 이 단계에 드는 GitHub 단계 이름들 — 시간 합산 · 실패한 단계 찾기 */
  gh: readonly string[];
};

export type Pipeline = {
  file: string; // .github/workflows/<file>
  name: string;
  group: "daily" | "monthly";
  scheduleText: string;
  /** '다음 예약' 계산 — GitHub 예약(UTC). Account Watch 는 이 Mac 신호 시각(토론토) */
  crons: readonly Cron[];
  /** 예약이 GitHub 가 몇 시간씩 늦게 띄우는 밤 작업인지 (늦게 시작한 평균을 보여 준다) */
  showDelay: boolean;
  /** 작업 시간 한도 (분) — 넘기면 GitHub 가 중간에 멈춘다 */
  limitMin: number;
  /** 수동 실행(workflow_dispatch)을 부르는 이름 — Account Watch 는 이 Mac 이 평소에 그렇게 띄운다 */
  dispatchLabel: string;
  lead: string;
  impact: string;
  impactStrong?: boolean;
  where: string;
  steps: readonly PipelineStep[];
  outputs: readonly string[];
  /** 최근 실행 몇 개를 받을지 (Account Watch 는 하루 14번이라 많이) */
  runs: number;
  /** 마지막 성공 실행의 단계별 시간을 받아 '어디에 시간이 드나'를 그릴지 */
  timing: boolean;
  /** 오늘 하루 시간표에 넣을지 */
  timeline: boolean;
  /** 장중 30분마다처럼 짧게 자주 도는 작업 — 시간표에 막대 대신 눈금 */
  tick?: boolean;
};

const SETUP = ["Set up job", "Check out repository", "Set up Python", "Install dependencies", "Configure git identity"];

export const PIPELINES: readonly Pipeline[] = [
  {
    file: "run-screener.yml",
    name: "Run Screener",
    group: "daily",
    scheduleText: "매일 밤 (예약 00:45 UTC)",
    crons: [{ expr: "45 0 * * *", tz: "UTC" }],
    showDelay: true,
    limitMin: 360,
    dispatchLabel: "수동",
    lead: "매일 밤 메인 작업이에요. 점수를 매기고, PT-1을 사고팔고, 메일을 보내고, 사이트 대부분의 데이터를 만들어요.",
    impact: "실패하면 매매 · 메일에 영향",
    impactStrong: true,
    where: "GitHub",
    steps: [
      {
        label: "준비",
        desc: "패키지 설치 · 유닛 테스트 · 지역 매출 · ETF 보유 파일 받기 · Yahoo 연결 확인",
        gh: [...SETUP, "Install Playwright browsers", "Run unit tests", "Restore Google service account credentials",
          "Get geo revenue (SEC)", "Get ETF holdings (SEC)", "Set log date", "Yahoo Finance connectivity check"],
      },
      { label: "스크리너", desc: "S&P 500 점수 · 패턴 · 차트분석 캡처 → 시트 [SP500 분석]", gh: ["Run screener pipeline", "Upload screener log"] },
      { label: "전체 시장 스캔", desc: "NASDAQ/NYSE 후보 좁히기 · 차트분석 캡처 → [NASDAQ/NYSE 분석]", gh: ["Run full market scan", "Upload full scan log"] },
      { label: "숏스퀴즈 감시", desc: "공매도 잔고 · 발사 신호", gh: ["Short squeeze watch"] },
      {
        label: "PT-1 매매",
        desc: "사고팔기 + PT-SPY 기준선 + 내계좌 리포트 → 메일",
        gh: ["Run unified paper trading", "Upload paper trading log", "Run PT-SPY (SPY buy & hold benchmark)",
          "Run 내계좌 portfolio report", "Upload portfolio report log"],
      },
      { label: "헬스체크 · 상태 저장", desc: "결과를 main 에 커밋하고 올라갔는지 확인", gh: ["Health check", "Commit & push logs and paper trading state", "Verify state pushed"] },
      { label: "차트 캡처", desc: "1차 선별 차트 → WebP (보여 주기용)", gh: ["Capture remaining charts (web 전체차트)", "Convert chart captures to WebP (web)"] },
      { label: "ETF · 경제 스캔", desc: "[ETF] · [경제] 시트 · etf.json · macro.json", gh: ["ETF scan", "Macro scan"] },
      {
        label: "웹 데이터 올리기",
        desc: "dashboard-data · 차트 브랜치 → 사이트 새로고침",
        gh: ["Export web dashboard data", "Push chart screenshots (orphan branch — no history accumulation)",
          "Push web dashboard data (orphan branch)", "Refresh personal website"],
      },
      { label: "실패하면", desc: "알림 메일", gh: ["Notify on failure"] },
    ],
    outputs: ["시트 [SP500 분석]", "시트 [NASDAQ/NYSE 분석]", "시트 [ETF] · [경제]", "PT 메일", "PT 상태 (main)",
      "사이트 오늘", "매수 후보 · 1차 선별", "ETF 탭", "내계좌"],
    runs: 8,
    timing: true,
    timeline: true,
  },
  {
    file: "universe-scan.yml",
    name: "Universe Scan",
    group: "daily",
    scheduleText: "매일 밤 (예약 01:15 UTC)",
    crons: [{ expr: "15 1 * * *", tz: "UTC" }],
    showDelay: true,
    limitMin: 300,
    dispatchLabel: "수동",
    lead: "필터 없이 시장 전체(약 5,300종목)를 Run Screener와 같은 방법으로 분석해서 시트와 사이트에 보여 줘요.",
    impact: "보여 주기만 · 매매와 무관",
    where: "GitHub",
    steps: [
      { label: "준비", desc: "패키지 설치 · 지역 매출 파일 받기", gh: [...SETUP, "Restore Google service account credentials", "Get geo revenue (SEC)"] },
      { label: "전날 값 되살리기", desc: "종목 정보 · 종목 상세 캐시", gh: ["Restore previous universe snapshot"] },
      {
        label: "분석",
        desc: "S&P 500 + NASDAQ/NYSE 전체 점수 · 패턴 · 골든크로스 + 신규 상장, 공시 · 공매도 · 내부자 · ISB · SQZ, 시장 폭 · 실적 일정 · 종목 상세(최대 25분)",
        gh: ["Run universe scan", "Upload universe scan log"],
      },
      { label: "올리기", desc: "시트 3개 탭 → universe-data → 사이트 새로고침", gh: ["Push universe data (orphan branch)", "Refresh personal website"] },
    ],
    outputs: ["시트 [SP500 전체]", "시트 [NASDAQ/NYSE 전체]", "시트 [신규상장]", "전체분석", "종목 페이지",
      "오늘 · 시장 한눈에 · 실적 일정", "섹터 지도"],
    runs: 8,
    timing: true,
    timeline: true,
  },
  {
    file: "account-watch.yml",
    name: "Account Watch",
    group: "daily",
    scheduleText: "월~금 9:30~16:00 · 30분마다 (이 Mac 이 신호)",
    crons: [
      { expr: "30 9 * * 1-5", tz: "America/Toronto" },
      { expr: "0,30 10-15 * * 1-5", tz: "America/Toronto" },
      { expr: "0 16 * * 1-5", tz: "America/Toronto" },
    ],
    showDelay: false,
    limitMin: 10,
    dispatchLabel: "Mac 신호",
    lead: "장중 30분마다 내계좌 종목을 확인해서 휴대폰으로 요약을 보내고, 새 알림이 있으면 메일도 보내요. GitHub 예약은 몇 시간씩 늦어서 예비로만 두고, 평소엔 이 Mac 이 띄워요.",
    impact: "시트는 읽기만",
    where: "GitHub · 신호는 이 Mac",
    steps: [
      { label: "장 시간 확인", desc: "휴장일이거나 장 밖이면 그냥 끝", gh: ["Market-hours gate"] },
      { label: "준비", desc: "패키지 설치 · 알림 기록 받기", gh: [...SETUP, "Restore alert state"] },
      {
        label: "확인 · 알림",
        desc: "내계좌 시트(보유 · 목표가 · 관심종목) → 현재가 → ntfy 요약 매번, 새 알림(손절 · 근접 · 목표가 · ±5% · 관심종목)은 ntfy + 메일",
        gh: ["Run account watch"],
      },
      { label: "알림 기록 저장", desc: "같은 알림은 하루 한 번만", gh: ["Save alert state (orphan branch)"] },
    ],
    outputs: ["휴대폰 알림 (ntfy)", "메일", "account-watch 브랜치"],
    runs: 20,
    timing: false,
    timeline: true,
    tick: true,
  },
  {
    file: "geo-revenue.yml",
    name: "Geo Revenue",
    group: "monthly",
    scheduleText: "매달 3일 (예약 15:30 UTC)",
    crons: [{ expr: "30 15 3 * *", tz: "UTC" }],
    showDelay: false,
    limitMin: 330,
    dispatchLabel: "수동",
    lead: "회사별 미국 매출 비중을 SEC 연간 보고서(10-K)에서 뽑아요. 섹터의 내수 · 글로벌 구분에 써요.",
    impact: "SEC 10-K",
    where: "GitHub",
    steps: [
      { label: "지난달 파일 받기", desc: "geo-data 의 geo_revenue.csv", gh: [...SETUP, "Get previous file"] },
      { label: "새 10-K 만 다시", desc: "10-K 가 새로 나온 회사만 다시 받기", gh: ["Build geo_revenue.csv"] },
      { label: "올리기", desc: "geo-data → 밤 작업 둘(Run Screener · Universe Scan)이 읽음", gh: ["Push geo data (orphan branch)"] },
    ],
    outputs: ["geo-data", "섹터 지도", "종목 성격"],
    runs: 6,
    timing: false,
    timeline: false,
  },
  {
    file: "etf-holdings.yml",
    name: "ETF Holdings",
    group: "monthly",
    scheduleText: "매달 5일 (예약 15:30 UTC)",
    crons: [{ expr: "30 15 5 * *", tz: "UTC" }],
    showDelay: false,
    limitMin: 90,
    dispatchLabel: "수동",
    lead: "ETF 143개의 전체 보유 종목을 SEC N-PORT 공시에서 받아요.",
    impact: "SEC N-PORT",
    where: "GitHub",
    steps: [
      { label: "지난달 파일 받기", desc: "etf-data 의 etf_holdings.csv", gh: [...SETUP, "Get previous file"] },
      { label: "바뀐 ETF 만 다시", desc: "공시 번호가 바뀐 ETF 만 다시 받기", gh: ["Build etf_holdings.csv"] },
      { label: "올리기", desc: "etf-data → Run Screener 가 읽음", gh: ["Push ETF data (orphan branch)"] },
    ],
    outputs: ["etf-data", "ETF 탭 성격", "내계좌 쏠림"],
    runs: 6,
    timing: false,
    timeline: false,
  },
  {
    file: "update-sp500.yml",
    name: "S&P 500 목록",
    group: "monthly",
    scheduleText: "매달 1일 (예약 14:00 UTC)",
    crons: [{ expr: "0 14 1 * *", tz: "UTC" }],
    showDelay: false,
    limitMin: 360,
    dispatchLabel: "수동",
    lead: "S&P 500 구성 종목 목록을 새로 받아서, 바뀌었으면 main 에 커밋해요. 다음 밤 실행부터 반영돼요.",
    impact: "main 커밋",
    where: "GitHub",
    steps: [
      { label: "최신 목록 받기", desc: "구성 종목 · 바뀐 내역", gh: [...SETUP, "Update S&P 500 list"] },
      { label: "커밋", desc: "바뀌었을 때만 main 에", gh: ["Commit & push"] },
      { label: "실패하면", desc: "알림 메일", gh: ["Notify on failure"] },
    ],
    outputs: ["main · 종목 목록"],
    runs: 6,
    timing: false,
    timeline: false,
  },
];

/** 결과 데이터 — 사이트가 읽는 파일의 만든 시각(generated_at) 또는 브랜치 마지막 커밋. */
export type DataSource = {
  key: string;
  label: string;
  by: string;
  use: string;
  /** 이 시간(시간 단위)보다 오래되면 노랗게 */
  staleH: number | null;
  /** generated_at 을 읽을 파일 종류, 또는 브랜치 이름 */
  from: { kind: "dashboard" | "etf" | "macro" | "market" } | { kind: "branch"; branch: string };
};

export const DATA_SOURCES: readonly DataSource[] = [
  { key: "dashboard", label: "dashboard.json", by: "Run Screener", use: "오늘 · 매수 후보 · 1차 선별 · 내계좌 · 시세 줄", staleH: 26, from: { kind: "dashboard" } },
  { key: "etf", label: "etf.json", by: "Run Screener (ETF 스캔)", use: "ETF 탭 · 내계좌 쏠림", staleH: 26, from: { kind: "etf" } },
  { key: "macro", label: "macro.json", by: "Run Screener (경제 스캔)", use: "오늘 경기 상태 · 금리 결정", staleH: 26, from: { kind: "macro" } },
  { key: "market", label: "universe-data", by: "Universe Scan", use: "전체분석 · 종목 페이지 · 시장 한눈에 · 실적 일정", staleH: 26, from: { kind: "market" } },
  { key: "geo", label: "geo-data", by: "Geo Revenue", use: "밤 작업 → 섹터 지도 · 종목 성격", staleH: 24 * 35, from: { kind: "branch", branch: "geo-data" } },
  { key: "etfdata", label: "etf-data", by: "ETF Holdings", use: "밤 작업 → ETF 탭 성격 · 내계좌 쏠림", staleH: 24 * 35, from: { kind: "branch", branch: "etf-data" } },
  { key: "acct", label: "account-watch", by: "Account Watch", use: "같은 알림 하루 한 번 (사이트는 안 씀)", staleH: null, from: { kind: "branch", branch: "account-watch" } },
];

/** 지표별 계산 위치 (2026-11-04 코드 기준 — 바뀌면 손으로 고친다). */
export const INDICATOR_ROWS: readonly { name: string; screener: string; universe: string; price: string; trade: string | null }[] = [
  { name: "점수 · 적합도", screener: "스크리너 · 전체 시장 스캔 단계 (필터 뒤 수백 종목)", universe: "분석 단계 · 5,300종목", price: "배당 조정", trade: "PT-1 후보 · 순위" },
  { name: "차트 패턴 25종 · 골든/데드크로스 라벨", screener: "같은 단계 · 같은 종목", universe: "같은 단계 · 전부", price: "차트 가격 (분할만)", trade: "PT-1 후보 점수의 패턴 항목" },
  { name: "ISB", screener: "웹 데이터 내보내기 단계 (사이트에 나오는 종목만)", universe: "전부", price: "차트 가격 (분할만)", trade: null },
  { name: "SQZ 모멘텀", screener: "웹 데이터 내보내기 단계 (사이트에 나오는 종목만)", universe: "전부", price: "차트 가격 (분할만)", trade: null },
  { name: "실적 때 움직임", screener: "웹 데이터 내보내기 단계", universe: "전부", price: "차트 가격 (분할만)", trade: null },
  { name: "내부자 거래", screener: "웹 데이터 내보내기 단계", universe: "전부", price: "—", trade: null },
  { name: "공매도 비중 · SEC 공시 경고", screener: "스크리너 · 전체 시장 스캔 단계", universe: "전부", price: "—", trade: null },
  { name: "숏스퀴즈 감시", screener: "숏스퀴즈 감시 단계", universe: "— (공매도 칸만)", price: "—", trade: null },
];
