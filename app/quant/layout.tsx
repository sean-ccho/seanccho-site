import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { BottomTabs } from "@/components/BottomTabs";
import { BrandMark } from "@/components/BrandMark";
import { BuyProvider } from "@/components/BuyDialog";
import { ChartPrefsProvider } from "@/components/ChartPrefs";
import { LangToggle } from "@/components/LangToggle";
import { QuantNav } from "@/components/QuantNav";
import { TickerSearch } from "@/components/TickerSearch";
import { TickerTape } from "@/components/TickerTape";
import { UserMenu } from "@/components/UserMenu";
import { LiveRefresher } from "@/components/LiveRefresher";
import { DataStatusChip } from "@/components/DataStatusChip";
import { getDashboardCore } from "@/lib/dashboard";
import { getDataStatus } from "@/lib/universeServer";
import { getLiveMark } from "@/lib/live";
import { fmtDate, fmtDateTime, todayToronto } from "@/lib/format";
import type { DsFile } from "@/lib/dataStatus";
import { getT } from "@/lib/lang";
import { getViewer, loginEnabled, viewerInfo } from "@/lib/viewer";

/** 검색 결과에 나오는 설명 (2026-11-25 검색 노출을 켤 때). 페이지가 따로 정하면 그쪽이 이긴다 (종목 페이지). */
const DESCRIPTION = {
  ko: "미국 · 캐나다 주식 퀀트 대시보드 — 매일 밤 퀀트 점수 · 차트 패턴 · 밸류에이션 · 섹터 지도 · 내부자 · 국회의원 거래.",
  en: "US & Canadian stock quant dashboard — nightly quant scores, chart patterns, valuation, sector map, insider and congressional trades.",
} as const;

/**
 * 검색 노출 (2026-11-25, 사용자: "검색노출될수있게") — 10-15 첫 버전부터 /quant 전체가 noindex 였다. 이제 공개 화면은 검색에 올리고,
 * 관리자 화면(내계좌 묶음 · 관리 · 로그인)만 각 페이지가 NO_INDEX 로 막는다 + app/robots.ts 가 긁지 말라고 한다.
 * 구글 로봇은 브라우저 언어를 안 보내서 영어 화면을 본다 (lib/lang.ts) — 검색 결과에는 영어로 나온다.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getT();
  return {
    title: { default: t.today.metaTitle, template: `%s · ${t.today.metaTitle}` },
    description: DESCRIPTION[lang],
    robots: { index: true, follow: true },
  };
}

/** 퀀트 화면은 토스식 밝은 색 — 브라우저 위쪽 막대도 머리와 같은 흰색 (2026-11-06, 그 전엔 #0b1019). */
export const viewport: Viewport = { themeColor: "#ffffff" };

/** 데이터를 만든 뒤 몇 분 지났는지 (페이지는 요청마다 새로 그려서 지금 시각 기준). */
function minutesSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60000)) : 0;
}

const STALE_MIN = 26 * 60; // 매일 새벽 실행 — 26시간 넘게 안 바뀌면 그날 실행이 실패한 것

export default async function QuantLayout({ children }: { children: React.ReactNode }) {
  const [data, { lang, t }, mark, ds, viewer] = await Promise.all([getDashboardCore(), getT(), getLiveMark(), getDataStatus(), getViewer()]);
  // '내계좌' 메뉴 · 아래 탭 · '+ 매수' 버튼은 관리자로 로그인한 사람만 (2026-11-24, 사용자: "다른사람들은 내계좌탭이 아예 안보이게").
  // 다른 방문자 · 회원에겐 내계좌 묶음(내 계좌 · 관심종목 · PT-1 · PT 거래로그)이 아예 안 보인다 — 그 전엔 공개 PT-1 로 보냈다.
  const admin = viewer?.role === "admin";
  const age = data ? minutesSince(data.generated_at) : 0;
  // 자료 상태 (2026-11-13) — 매수 후보 쪽(dashboard.json, 사이트가 셈) + 밤 점검 파일(전체분석 · 캐나다 · 예측 모델 · 국회의원).
  // 점검 파일을 못 받으면 그 줄들이 조용히 빠지던 것 → '점검 파일 없음' (2026-11-18)
  const noCheck: DsFile = { label: "전체분석 · 예측 모델 · 국회의원 점검", rows: [], missing: true };
  const statusFiles = [...(data?.data_status ? [data.data_status] : []), ...(ds ? Object.values(ds.files) : [noCheck])];
  // 장중 펄스가 밤 데이터보다 새것이면 (2026-11-09) — '장중 11:30 ET · 15분마다' (파란 점) · '16:00 마감 · 잠정' (회색)
  const live = data?.live ?? null;
  const L = t.live;
  // 밤 분석이 펄스가 본 전 거래일보다 이르면 어젯밤 실행이 안 된 것 (2026-11-18) — 예전엔 '장중' 표시가 오래됨 점을 가렸다
  const behind = !!(live?.base && data?.bar_date && data.bar_date < live.base);
  const stale = !!data && (age > STALE_MIN || behind || !!live?.late);
  const today = todayToronto();
  const liveLong = !live ? "" : live.state === "closing"
    ? (live.day === today ? L.closing(live.at) : L.closingDated(fmtDate(live.day, lang), live.at))
    : live.us === "holiday" ? L.usHoliday(live.at)
    : live.us === "closed" ? L.usClosed(live.usClose ?? "", live.at)
    : L.status(live.at);
  const liveShort = !live ? "" : live.state === "closing"
    ? (live.day === today ? L.closingShort(live.at) : L.closingDatedShort(fmtDate(live.day, lang), live.at))
    : live.us === "holiday" ? L.usHolidayShort(live.at)
    : live.us === "closed" ? L.usClosedShort(live.usClose ?? "", live.at)
    : L.statusShort(live.at);
  return (
    <div className="q-shell">
      {/* 토스식 글꼴 (2026-11-06) — Pretendard, 쓰는 글자 묶음만 받는 나눔 파일 (globals.css --font-sans 가 먼저 찾는다) */}
      <link rel="stylesheet" precedence="default"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href="/" className="brand">
            <BrandMark />
            <span>PT-1</span>
            <span className="brand__tag">{t.nav.personal}</span>
          </Link>
          <QuantNav showAccount={admin} />
          <div className="q-status" title={live ? L.statusTitle : t.status.schedule}>
            <span
              className={`q-status__dot${stale ? " q-status__dot--stale" : live ? ` q-status__dot--${live.state}` : ""}`}
              aria-hidden="true"
            />
            {data && live ? (
              <>
                <span className="q-status__long">
                  {liveLong}
                  {live.late && <span className="q-status__behind">{" · "}{L.late(t.status.ago(live.late))}</span>}
                  {/* 머리 한 줄에 들어가게 짧게 — 긴 설명은 마우스를 올리면 (데스크톱 1440 에서 언어 버튼이 밀렸다) */}
                  {behind && (
                    <span className="q-status__behind" title={L.behind(fmtDate(data.bar_date, lang))}>
                      {" · "}{L.behindShort(fmtDate(data.bar_date, lang))}
                    </span>
                  )}
                </span>
                <span className="q-status__short">
                  {liveShort}
                  {live.late && <span className="q-status__behind">{" · "}{L.lateShort}</span>}
                  {behind && <span className="q-status__behind">{" · "}{L.behindShort(fmtDate(data.bar_date, lang))}</span>}
                </span>
              </>
            ) : data ? (
              <>
                <span className="q-status__long">
                  {t.status.asOf(fmtDate(data.price_date ?? data.bar_date, lang, true))}
                  {" · "}
                  <time dateTime={data.generated_at}>
                    {t.status.updated(fmtDateTime(data.generated_at, lang), t.status.ago(age))}
                  </time>
                </span>
                {/* 폰: 한 줄로 짧게 */}
                <span className="q-status__short">
                  {t.status.short(fmtDate(data.price_date ?? data.bar_date, lang), t.status.ago(age))}
                </span>
              </>
            ) : (
              <span>{t.status.failed}</span>
            )}
            <DataStatusChip files={statusFiles} variant="global" />
          </div>
          <TickerSearch />
          <LangToggle />
          <UserMenu viewer={viewerInfo(viewer)} enabled={loginEnabled()} />
        </div>
      </header>
      {data && <TickerTape data={data} t={t} />}
      <BuyProvider enabled={admin}>
        <ChartPrefsProvider>{children}</ChartPrefsProvider>
      </BuyProvider>
      <footer className="q-footer">
        <div className="container q-footer__inner">
          <p>{t.footer.disclaimer}</p>
          <p>{t.footer.sources}</p>
          {data && <p>{t.footer.generated(fmtDateTime(data.generated_at, lang))}</p>}
        </div>
      </footer>
      <BottomTabs showAccount={admin} />
      <LiveRefresher stamp={mark?.stamp ?? null} />
    </div>
  );
}
