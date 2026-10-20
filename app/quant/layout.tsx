import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { BuyProvider } from "@/components/BuyDialog";
import { LangToggle } from "@/components/LangToggle";
import { QuantNav } from "@/components/QuantNav";
import { TickerTape } from "@/components/TickerTape";
import { getDashboard } from "@/lib/dashboard";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { getT } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { default: t.today.metaTitle, template: `%s · ${t.today.metaTitle}` },
    robots: { index: false, follow: false },
  };
}

/** 퀀트 화면은 늘 어두운 터미널 색 (브라우저 위쪽 막대도 같은 색). */
export const viewport: Viewport = { themeColor: "#0b1019" };

/** 데이터를 만든 뒤 몇 분 지났는지 (페이지는 요청마다 새로 그려서 지금 시각 기준). */
function minutesSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60000)) : 0;
}

const STALE_MIN = 26 * 60; // 매일 새벽 실행 — 26시간 넘게 안 바뀌면 그날 실행이 실패한 것

export default async function QuantLayout({ children }: { children: React.ReactNode }) {
  const [data, { lang, t }] = await Promise.all([getDashboard(), getT()]);
  const age = data ? minutesSince(data.generated_at) : 0;
  return (
    <div className="q-shell">
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
              <span>
                {t.status.asOf(fmtDate(data.price_date ?? data.bar_date, lang, true))}
                {" · "}
                <time dateTime={data.generated_at}>
                  {t.status.updated(fmtDateTime(data.generated_at, lang), t.status.ago(age))}
                </time>
              </span>
            ) : (
              <span>{t.status.failed}</span>
            )}
          </div>
          <LangToggle />
        </div>
      </header>
      {data && <TickerTape data={data} t={t} />}
      <BuyProvider>{children}</BuyProvider>
    </div>
  );
}
