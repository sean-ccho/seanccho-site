import { Suspense } from "react";
import { MacroSection, MacroSkeleton } from "@/components/MacroSection";
import { CongressToday } from "@/components/CongressSection";
import { MarketPick } from "@/components/MarketSwitch";
import { EarningsCalendar, MarketToday } from "@/components/MarketToday";
import { NewsBrief, NewsBriefSkeleton } from "@/components/NewsSection";
import { fmtDate, todayToronto } from "@/lib/format";
import { getT } from "@/lib/lang";

export const revalidate = 1800;

/**
 * 오늘 — '데일리 브리핑' (2026-11-10): 카드 다섯 개를 위에서부터
 *  오늘의 핵심 뉴스(미국 · 전세계 · 한국/캐나다 TOP 5 + 주제 칩) → 시장 한눈에 → 경기 상태 · 금리 결정 → 이번 주 일정 · 실적 발표
 *  (맨 아래 펼치면 다가오는 큰 일정) → 국회의원 거래 신고.
 * 시장 한눈에 · 이번 주 일정은 같은 [미국 | 캐나다] 선택을 따른다 (MarketPick — 그 사이 경기 카드는 시장과 상관없음).
 * PT-1 화면(평가액·보유·청산·후보)은 내계좌 › PT-1 탭(/quant/pt1) — 계좌 정보는 오늘 탭에 두지 않는다.
 */
export default async function TodayPage() {
  const { lang, t } = await getT();
  const B = t.brief;
  return (
    <main className="container container--wide page brief">
      <div className="page-title brief-title">
        <h1>
          {B.pageTitle} <span className="brief-date">{fmtDate(todayToronto(), lang, true)}</span>
        </h1>
        <p>{B.pageSub}</p>
      </div>
      <Suspense fallback={<NewsBriefSkeleton t={t} />}>
        <NewsBrief lang={lang} />
      </Suspense>
      <MarketPick>
        <Suspense fallback={null}>
          <MarketToday lang={lang} t={t} />
        </Suspense>
        <Suspense fallback={<MacroSkeleton t={t} />}>
          <MacroSection lang={lang} t={t} />
        </Suspense>
        <Suspense fallback={null}>
          <EarningsCalendar lang={lang} t={t} />
        </Suspense>
      </MarketPick>
      {/* 국회의원 거래 신고 (2026-11-06) — universe-data congress.json, 하원 PTR · 표시 전용 */}
      <Suspense fallback={null}>
        <CongressToday lang={lang} t={t} />
      </Suspense>
    </main>
  );
}
