import { TodayNews } from "@/components/NewsSection";
import { getT } from "@/lib/lang";

export const revalidate = 1800;

/** 오늘 — 뉴스만 (2026-10-29). PT-1 화면(평가액·보유·청산·후보)은 내계좌 › PT-1 탭(/quant/pt1)으로 옮겼다. */
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
    </main>
  );
}
