import type { Metadata } from "next";
import { CandidatesView } from "@/components/CandidatesView";
import { NoData } from "@/components/NoData";
import { chartIndex, getDashboard } from "@/lib/dashboard";
import type { ChartImages } from "@/lib/types";

export const revalidate = 1800;
export const metadata: Metadata = { title: "스크리너 후보" };

export default async function CandidatesPage() {
  const data = await getDashboard();
  if (!data) return <NoData />;
  const all = chartIndex(data);
  // 후보 종목 차트만 넘긴다 (페이지 크기 줄이기)
  const images: Record<string, ChartImages> = {};
  for (const c of data.candidates) if (all[c.ticker]) images[c.ticker] = all[c.ticker];

  return (
    <main className="container page">
      <div className="page-title">
        <h1>스크리너 매수 후보</h1>
        <p>S&amp;P 500·나스닥에서 &apos;매수 후보&apos; 판정을 받은 종목, 매수 적합도 순 · PT-1은 이 중 CCS 점수로 골라 빈 자리를 채웁니다</p>
      </div>
      <CandidatesView candidates={data.candidates} images={images} />
      <section className="row row--3" aria-label="읽는 법">
        <div className="card">
          <h2 style={{ fontSize: 14 }}>매수 적합도</h2>
          <p className="small muted" style={{ margin: "4px 0 0" }}>스크리너가 매긴 별점 점수. 높을수록 지금 매수 조건에 잘 맞습니다.</p>
        </div>
        <div className="card">
          <h2 style={{ fontSize: 14 }}>헬스체크</h2>
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            매출·마진·이익 성장으로 매긴 0–100 재무 점수. A 이상은 초록, B·C는 회색, D·F는 붉은색입니다.
          </p>
        </div>
        <div className="card">
          <h2 style={{ fontSize: 14 }}>주의 표시</h2>
          <p className="small muted" style={{ margin: "4px 0 0" }}>실적 발표가 14일 안이면 &apos;실적 임박&apos;, RSI 70 이상은 과열로 표시합니다.</p>
        </div>
      </section>
    </main>
  );
}
