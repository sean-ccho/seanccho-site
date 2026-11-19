import type { Metadata } from "next";
import { BlogWatchNotice } from "@/components/BlogWatchNotice";
import { PickTabs } from "@/components/PickTabs";
import { ValueModelGuide } from "@/components/ValueModelGuide";
import { guideSections } from "@/lib/valueModelGuideSections";
import { ValueModelRetro } from "@/components/ValueModelRetro";
import { BoardView, DocRules, docSections, ScreenTable, VmKpis, VmTabBar } from "@/components/ValueModelViews";
import { funnelCounts, getDashboard } from "@/lib/dashboard";
import { valueModelStatus } from "@/lib/dataStatus";
import { getT } from "@/lib/lang";
import { getBlogWatch, getValueModel, VM_RETRO, vmTab } from "@/lib/valueModel";

export const revalidate = 1800;

type Props = { searchParams: Promise<{ tab?: string; v?: string }> };

// 매수 후보 › 예측 모델 (2026-11-16 내계좌에서 옮김) — 위 숫자 4칸 + 탭 2개(?tab=):
// 분석가 보드(기본 — 주니어(v1) · 시니어(v2) 통과 픽, 주니어 | 시니어 | 수석 PM(v3) | 리서치 네 칸, 성적표) ·
// 문서 기록(분석가 규칙 · 회고 · 스크린 과거 목록 · 리서치 정리 1~8).
// 공개 페이지 (2026-11-17 비밀번호 뺌). 본문은 한국어만. 리서치 출처 이름은 화면 어디에도 쓰지 않는다 (사용자 2026-11-16).

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.nav.model };
}

export default async function ModelPage({ searchParams }: Props) {
  const [{ model, live, failed, failedFunnel }, watch, dash, { t, lang }, sp] = await Promise.all([
    getValueModel(),
    getBlogWatch(),
    getDashboard(),
    getT(),
    searchParams,
  ]);
  const tab = vmTab(sp.tab, sp.v);
  return (
    <main className="container container--wide page vm-page">
      <PickTabs current="model" t={t} counts={dash ? funnelCounts(dash) : undefined} />
      <div className="page-title vm-title">
        <h1>{t.nav.model}</h1>
        <p>
          {lang === "en"
            ? "Analysts each hunt for stocks using the research's value-investing logic — the junior analyst (v1) follows the research checklist as is, the senior analyst (v2) adds downside gates and disconfirming conditions, and the lead PM (v3) filters the senior's candidates further for SBC, debt, dilution and sector concentration to build a 10-slot portfolio (empty slots are SPY). All of them pick from the same universe without knowing the research's stocks, and are tracked from the same day as the research list (coverage + research notes) to see who does better."
            : "리서치의 가치주 로직으로 분석가들이 각자 종목을 찾는다 — 주니어 분석가(v1)는 리서치 체크리스트 그대로, 시니어 분석가(v2)는 하방 관문 · 반증 조건을 더한 규칙, 수석 PM(v3)은 시니어 후보에서 SBC · 부채 · 희석 · 업종 쏠림까지 걸러 10칸 포트폴리오(빈칸은 SPY)를 짠다. 모두 리서치 종목을 모르는 채 같은 대상에서 고르고, 리서치 목록(커버리지 + 리서치 노트)과 같은 날부터 기록해 누가 나은지 본다."}
        </p>
      </div>
      {tab === "board" && <VmKpis model={model} lang={lang} />}
      <VmTabBar tab={tab} model={model} live={live} failed={failed} lang={lang}
        status={valueModelStatus(model, live, failedFunnel)} />
      <div className="vm-body">
        <BlogWatchNotice watch={watch} lang={lang} />
        {tab === "board" && <BoardView model={model} lang={lang} />}
        {tab === "doc" && <>
          <nav className="vm-toc" aria-label={lang === "en" ? "Contents" : "목차"}>
            {[...docSections(lang), ...guideSections(lang)].map((s) => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
          </nav>
          <DocRules model={model} lang={lang} />
          <ValueModelRetro retro={VM_RETRO} lang={lang} />
          <ScreenTable model={model} lang={lang} />
          <ValueModelGuide />
        </>}
        <p className="vm-fine">
          {lang === "en"
            ? "Not a buy recommendation — just the result of running the candidate-finding procedure as is. Financials are yfinance's 4–5 years of annual data, so the coefficient-of-variation test is stricter than the research's 10-year basis (one bad year is enough to fail). For borderline stocks, a single beta can flip the conclusion."
            : "매수 추천이 아니다 — 후보를 찾는 절차를 그대로 돌린 결과. 재무는 yfinance 연간 4~5년치라 변동계수가 리서치의 10년 기준보다 엄격하게 걸린다(한 해만 나빠도 탈락). 경계선 종목은 베타 하나로 결론이 바뀔 수 있다."}
        </p>
      </div>
    </main>
  );
}
