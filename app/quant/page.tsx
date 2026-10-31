import { Suspense } from "react";
import { MacroSection, MacroSkeleton } from "@/components/MacroSection";
import { TodayNews } from "@/components/NewsSection";
import { getT } from "@/lib/lang";

export const revalidate = 1800;

/**
 * 오늘 — 뉴스 + 그 아래 경기 상태 · 금리 결정 (2026-10-30, macro.json). PT-1 화면(평가액·보유·청산·후보)은
 * 내계좌 › PT-1 탭(/quant/pt1)으로 옮겼다.
 */
export default async function TodayPage() {
  const { lang, t } = await getT();
  return (
    <main className="container container--wide page">
      <div className="page-title">
        <h1>{t.news.title}</h1>
        <p>{t.news.sub}</p>
      </div>
      <TodayNews lang={lang} t={t} />
      <p className="tiny muted" style={{ margin: 0 }}>{t.news.note}</p>
      <Suspense fallback={<MacroSkeleton t={t} />}>
        <MacroSection lang={lang} t={t} />
      </Suspense>
    </main>
  );
}
