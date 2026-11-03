import { Suspense } from "react";
import { MacroSection, MacroSkeleton } from "@/components/MacroSection";
import { TodayNews } from "@/components/NewsSection";
import { TodayGlance, TodayGlanceSkeleton } from "@/components/TodayGlance";
import { getT } from "@/lib/lang";

export const revalidate = 1800;

/**
 * 오늘 — 맨 위 '지금 경기 상태' 띠(지표 6개 · 다음 금리 결정, 2026-11-03) → 뉴스 → 경기 지표 자세히 · 금리 결정 (macro.json).
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
      <TodayNews lang={lang} t={t} />
      <p className="tiny muted" style={{ margin: 0 }}>{t.news.note}</p>
      <Suspense fallback={<MacroSkeleton t={t} />}>
        <MacroSection lang={lang} t={t} />
      </Suspense>
    </main>
  );
}
