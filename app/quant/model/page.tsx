import type { Metadata } from "next";
import { AccountTabs } from "@/components/AccountTabs";
import { BlogWatchNotice } from "@/components/BlogWatchNotice";
import { GUIDE_SECTIONS, ValueModelGuide } from "@/components/ValueModelGuide";
import { ValueModelRetro } from "@/components/ValueModelRetro";
import { AuthorView, CompareView, JuniorView, SeniorView, VmKpis, VmTabBar } from "@/components/ValueModelViews";
import { getT } from "@/lib/lang";
import { getBlogWatch, getValueModel, VM_RETRO, vmTab } from "@/lib/valueModel";

export const revalidate = 1800;

type Props = { searchParams: Promise<{ tab?: string; v?: string }> };

// 내계좌 › 예측 모델 (2026-11-11, 11-12 안쪽 탭으로 개편) — 위 숫자 4칸 + 탭(?tab=):
// 저자 대조(기본 — 저자 사이트 커버리지 · A-Series · 게시일 회고) · 주니어 분석가(v1) · 시니어 분석가(v2) · 둘 비교 · 문서 기록(블로그 정리 1~8).
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
          Baoro Research 블로그의 가치주 로직을 우리 데이터로 다시 돌린다 — 주니어 분석가(v1)는 저자 체크리스트 그대로, 시니어 분석가(v2)는
          하방 관문 · 반증 조건을 더한 규칙. 둘 다 저자 종목(사이트 Coverage + Ideas 리서치 글)과 같은 날부터 기록한다.
        </p>
        {lang === "en" && <p className="muted small">This page is written in Korean.</p>}
      </div>
      {tab !== "doc" && <VmKpis model={model} />}
      <VmTabBar tab={tab} model={model} live={live} failed={failed} lang={lang} />
      <div className="vm-body">
        {tab === "author" && <>
          <BlogWatchNotice watch={watch} lang={lang} />
          <AuthorView model={model} lang={lang} retro={<ValueModelRetro retro={VM_RETRO} lang={lang} />} />
        </>}
        {tab === "junior" && <JuniorView model={model} lang={lang} />}
        {tab === "senior" && <SeniorView model={model} lang={lang} />}
        {tab === "cmp" && <CompareView model={model} lang={lang} />}
        {tab === "doc" && <>
          <BlogWatchNotice watch={watch} lang={lang} />
          <nav className="vm-toc" aria-label="목차">
            {GUIDE_SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
          </nav>
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
