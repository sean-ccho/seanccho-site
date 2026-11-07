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
import { getDashboardCore } from "@/lib/dashboard";
import { fmtDate, fmtDateTime } from "@/lib/format";
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
  const [data, { lang, t }] = await Promise.all([getDashboardCore(), getT()]);
  const age = data ? minutesSince(data.generated_at) : 0;
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
          <QuantNav />
          <div className="q-status" title={t.status.schedule}>
            <span className={`q-status__dot${age > STALE_MIN ? " q-status__dot--stale" : ""}`} aria-hidden="true" />
            {data ? (
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
      <BottomTabs />
    </div>
  );
}
