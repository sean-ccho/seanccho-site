import type { Metadata } from "next";
import { ChartsView } from "@/components/ChartsView";
import { NoData } from "@/components/NoData";
import { getDashboard, latestCapture } from "@/lib/dashboard";
import { dateTimeKo } from "@/lib/format";

export const revalidate = 1800;
export const metadata: Metadata = { title: "차트" };

export default async function ChartsPage() {
  const data = await getDashboard();
  if (!data) return <NoData />;
  const captured = latestCapture(data);

  return (
    <main className="container page">
      <div className="page-title" id="top" style={{ scrollMarginTop: 16 }}>
        <h1>차트 모아보기</h1>
        <p>
          구글 시트 &apos;차트분석&apos; 탭과 같은 종목 · 아래로 스크롤하며 한 번에 보기 · 차트를 누르면 크게
          {captured ? ` · ${dateTimeKo(captured)} 촬영` : ""}
        </p>
      </div>
      <ChartsView markets={data.charts} />
    </main>
  );
}
