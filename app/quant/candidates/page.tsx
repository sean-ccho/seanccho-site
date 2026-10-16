import type { Metadata } from "next";
import { CandidatesView } from "@/components/CandidatesView";
import { NoData } from "@/components/NoData";
import { SqueezePanel } from "@/components/SqueezePanel";
import { chartIndex, getDashboard } from "@/lib/dashboard";
import { getT } from "@/lib/lang";
import type { ChartImages } from "@/lib/types";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.cands.metaTitle };
}

export default async function CandidatesPage() {
  const [data, { t }] = await Promise.all([getDashboard(), getT()]);
  if (!data) return <NoData />;
  const all = chartIndex(data);
  // 후보 종목 차트만 넘긴다 (페이지 크기 줄이기)
  const images: Record<string, ChartImages> = {};
  for (const c of data.candidates) if (all[c.ticker]) images[c.ticker] = all[c.ticker];

  return (
    <main className="container page">
      <div className="page-title">
        <h1>{t.cands.title}</h1>
        <p>{t.cands.sub}</p>
      </div>
      <SqueezePanel squeeze={data.squeeze} known={Object.keys(data.stocks ?? {})} />
      <CandidatesView candidates={data.candidates} images={images} />
      <section className="row row--3" aria-label={t.cands.howTo}>
        <div className="card">
          <h2 style={{ fontSize: 14 }}>{t.common.score}</h2>
          <p className="small muted" style={{ margin: "4px 0 0" }}>{t.cands.helpScore}</p>
        </div>
        <div className="card">
          <h2 style={{ fontSize: 14 }}>{t.common.health}</h2>
          <p className="small muted" style={{ margin: "4px 0 0" }}>{t.cands.helpHealth}</p>
        </div>
        <div className="card">
          <h2 style={{ fontSize: 14 }}>{t.cands.warnTitle}</h2>
          <p className="small muted" style={{ margin: "4px 0 0" }}>{t.cands.helpWarn}</p>
        </div>
      </section>
    </main>
  );
}
