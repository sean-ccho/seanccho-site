import { Suspense } from "react";
import { MacroSection, MacroSkeleton } from "@/components/MacroSection";
import { CongressToday } from "@/components/CongressSection";
import { BigEvents } from "@/components/EventsSection";
import { MarketPick } from "@/components/MarketSwitch";
import { EarningsCalendar, MarketToday } from "@/components/MarketToday";
import { TodayNews } from "@/components/NewsSection";
import { TodayGlance, TodayGlanceSkeleton } from "@/components/TodayGlance";
import { getT } from "@/lib/lang";

export const revalidate = 1800;

/**
 * 오늘 — 맨 위 '지금 경기 상태' 띠(지표 6개 · 다음 큰 일정, 2026-11-03 · 11-06) → 시장 한눈에 · 이번 주 일정 ·
 * 다가오는 큰 일정 ([미국 | 캐나다] 전환, 2026-11-06) → 뉴스 → 경기 지표 자세히 · 금리 결정 (macro.json).
 * PT-1 화면(평가액·보유·청산·후보)은 내계좌 › PT-1 탭(/quant/pt1) — 계좌 정보는 오늘 탭에 두지 않는다.
 */
export default async function TodayPage() {
  const { lang, t } = await getT();
  return (
    <main className="container container--wide page">
      <div className="page-title">
        <h1>{t.glance.pageTitle}</h1>
        <p>{t.glance.pageSub}</p>
      </div>
      <Suspense fallback={<TodayGlanceSkeleton t={t} />}>
        <TodayGlance lang={lang} t={t} />
      </Suspense>
      {/* 시장 한눈에 · 실적 발표 일정 (2026-11-03) — 전체분석 market.json. 미국 · 캐나다 전환 (2026-11-06) — 두 칸이 같은 선택 */}
      <MarketPick>
        <Suspense fallback={null}>
          <MarketToday lang={lang} t={t} />
        </Suspense>
        <Suspense fallback={null}>
          <EarningsCalendar lang={lang} t={t} />
        </Suspense>
        {/* 다가오는 큰 일정 (2026-11-06) — macro.json events + 대형주 실적 */}
        <Suspense fallback={null}>
          <BigEvents lang={lang} t={t} />
        </Suspense>
      </MarketPick>
      {/* 최근 국회의원 거래 신고 (2026-11-06) — universe-data congress.json, 하원 PTR · 표시 전용 */}
      <Suspense fallback={null}>
        <CongressToday lang={lang} t={t} />
      </Suspense>
      <TodayNews lang={lang} t={t} />
      <p className="tiny muted" style={{ margin: 0 }}>{t.news.note}</p>
      <Suspense fallback={<MacroSkeleton t={t} />}>
        <MacroSection lang={lang} t={t} />
      </Suspense>
    </main>
  );
}
