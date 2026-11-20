import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { BottomTabs } from "@/components/BottomTabs";
import { BrandMark } from "@/components/BrandMark";
import { BuyProvider } from "@/components/BuyDialog";
import { ChartPrefsProvider } from "@/components/ChartPrefs";
import { LangToggle } from "@/components/LangToggle";
import { QuantNav } from "@/components/QuantNav";
import { TickerSearch } from "@/components/TickerSearch";
import { TickerTape } from "@/components/TickerTape";
import { LiveRefresher } from "@/components/LiveRefresher";
import { DataStatusChip } from "@/components/DataStatusChip";
import { getDashboardCore } from "@/lib/dashboard";
import { getDataStatus } from "@/lib/universeServer";
import { getLiveMark } from "@/lib/live";
import { fmtDate, fmtDateTime, todayToronto } from "@/lib/format";
import type { DsFile } from "@/lib/dataStatus";
import { getT } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { default: t.today.metaTitle, template: `%s · ${t.today.metaTitle}` },
    robots: { index: false, follow: false },
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
  const [data, { lang, t }, mark, ds, jar] = await Promise.all([getDashboardCore(), getT(), getLiveMark(), getDataStatus(), cookies()]);
  // '내계좌' 메뉴 (2026-11-19) — 비밀번호를 한 번 넣은 브라우저(sc_owner, proxy.ts)만 바로 내 계좌로.
  // 다른 방문자는 공개 PT-1 로 — 링크드인 · 이력서로 들어온 사람이 메뉴를 누르자마자 로그인 창에 막히지 않게.
  const accountHref = jar.get("sc_owner")?.value === "1" ? "/quant/account" : "/quant/pt1";
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
          <QuantNav accountHref={accountHref} />
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
        </div>
      </header>
      {data && <TickerTape data={data} t={t} />}
      <BuyProvider>
        <ChartPrefsProvider>{children}</ChartPrefsProvider>
      </BuyProvider>
      <footer className="q-footer">
        <div className="container q-footer__inner">
          <p>{t.footer.disclaimer}</p>
          <p>{t.footer.sources}</p>
          {data && <p>{t.footer.generated(fmtDateTime(data.generated_at, lang))}</p>}
        </div>
      </footer>
      <BottomTabs accountHref={accountHref} />
      <LiveRefresher stamp={mark?.stamp ?? null} />
    </div>
  );
}
