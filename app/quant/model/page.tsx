import type { Metadata } from "next";
import { AccountTabs } from "@/components/AccountTabs";
import { BlogWatchNotice } from "@/components/BlogWatchNotice";
import { GUIDE_SECTIONS, ValueModelGuide } from "@/components/ValueModelGuide";
import { ValueModelRetro } from "@/components/ValueModelRetro";
import { BoardView, DOC_SECTIONS, DocRules, ScreenTable, VmKpis, VmTabBar } from "@/components/ValueModelViews";
import { getT } from "@/lib/lang";
import { getBlogWatch, getValueModel, VM_RETRO, vmTab } from "@/lib/valueModel";

export const revalidate = 1800;

type Props = { searchParams: Promise<{ tab?: string; v?: string }> };

// 내계좌 › 예측 모델 — 위 숫자 4칸 + 탭 2개(?tab=):
// 세 분석가(기본 — 주니어(v1) 통과 · 상위 10 | 시니어(v2) 통과 · 상위 10 | 저자 지금 목록 + 성적표) ·
// 문서 기록(세 분석가 규칙 · 회고 · A-Series 과거 목록 · 블로그 정리 1~8). 2026-11-12 밤에 탭 5개 → 2개로 정리.
// 비밀번호 페이지 (proxy.ts). 본문은 한국어만.

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.nav.acctTabs.model };
}

export default async function ModelPage({ searchParams }: Props) {
  const [{ model, live, failed }, watch, { t, lang }, sp] = await Promise.all([
    getValueModel(),
    getBlogWatch(),
    getT(),
    searchParams,
  ]);
  const tab = vmTab(sp.tab, sp.v);
  return (
    <main className="container container--wide page vm-page">
      <AccountTabs current="model" t={t} />
      <div className="page-title vm-title">
        <h1>{t.nav.acctTabs.model}</h1>
        <p>
          Baoro Research 블로그의 가치주 로직으로 세 분석가가 각자 종목을 찾는다 — 주니어 분석가(v1)는 저자 체크리스트 그대로,
          시니어 분석가(v2)는 하방 관문 · 반증 조건을 더한 규칙. 둘 다 저자 종목을 모르는 채 같은 대상에서 고르고, 저자(사이트
          Coverage + Ideas 리서치 글)와 같은 날부터 기록해 누가 나은지 본다.
        </p>
        {lang === "en" && <p className="muted small">This page is written in Korean.</p>}
      </div>
      {tab === "board" && <VmKpis model={model} />}
      <VmTabBar tab={tab} model={model} live={live} failed={failed} lang={lang} />
      <div className="vm-body">
        <BlogWatchNotice watch={watch} lang={lang} />
        {tab === "board" && <BoardView model={model} lang={lang} />}
        {tab === "doc" && <>
          <nav className="vm-toc" aria-label="목차">
            {[...DOC_SECTIONS, ...GUIDE_SECTIONS].map((s) => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
          </nav>
          <DocRules model={model} />
          <ValueModelRetro retro={VM_RETRO} lang={lang} />
          <ScreenTable model={model} lang={lang} />
          <ValueModelGuide />
        </>}
        <p className="vm-fine">
          매수 추천이 아니다 — 후보를 찾는 절차를 그대로 돌린 결과. 재무는 yfinance 연간 4~5년치라 변동계수가 저자의 10년 기준보다
          엄격하게 걸린다(한 해만 나빠도 탈락). 경계선 종목은 베타 하나로 결론이 바뀔 수 있다.
        </p>
      </div>
    </main>
  );
}
