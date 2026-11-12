import type { Metadata } from "next";
import { AccountTabs } from "@/components/AccountTabs";
import { GUIDE_SECTIONS, ValueModelGuide } from "@/components/ValueModelGuide";
import { ValueModelCoverage } from "@/components/ValueModelCoverage";
import { getT } from "@/lib/lang";
import { getValueModel, vmView } from "@/lib/valueModel";

export const revalidate = 1800;

type Props = { searchParams: Promise<{ v?: string }> };

// 내계좌 › 예측 모델 (2026-11-11) — Baoro Research 블로그 로직 정리(1~8) + 같은 기준으로 매일 다시 고르는 '우리 커버리지'.
// 비밀번호 페이지 (proxy.ts). 정리 글은 한국어만.

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.nav.acctTabs.model };
}

export default async function ModelPage({ searchParams }: Props) {
  const [{ model, live }, { t, lang }, sp] = await Promise.all([getValueModel(), getT(), searchParams]);
  const view = vmView(sp.v); // 우리 커버리지 v1 · v2 · 비교 (?v=)
  return (
    <main className="container container--wide page">
      <AccountTabs current="model" t={t} />
      <div className="page-title">
        <h1>{t.nav.acctTabs.model}</h1>
        <p>
          Baoro Research 블로그가 종목을 고르는 로직을 정리하고, 같은 기준으로 우리가 직접 고른 종목을 저자 커버리지와 나란히 기록한다.
        </p>
      </div>
      {lang === "en" && <p className="muted small">This page is written in Korean.</p>}
      <nav className="vm-toc" aria-label="목차">
        {GUIDE_SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
        <a href="#vm-ours" className="vm-toc__ours">우리 커버리지 ↓</a>
      </nav>
      <ValueModelGuide />
      <ValueModelCoverage model={model} live={live} lang={lang} view={view} />
    </main>
  );
}
