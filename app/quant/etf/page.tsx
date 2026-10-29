import type { Metadata } from "next";
import { ChartPrefsProvider } from "@/components/ChartPrefs";
import { EtfView } from "@/components/EtfView";
import { getEtf } from "@/lib/etf";
import { fmtDate } from "@/lib/format";
import { getT } from "@/lib/lang";

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.etf.metaTitle };
}

/** ETF — 유명하고 운용자산이 큰 ETF 를 묶음별로 (Project_1 screener.etf_scan 의 etf.json). 표시 전용. */
export default async function EtfPage() {
  const [data, { lang, t }] = await Promise.all([getEtf(), getT()]);
  return (
    <main className="container container--wide page">
      <div className="page-title">
        <h1>{t.etf.title}</h1>
        <p>
          {t.etf.sub(data?.items.length ?? 0)}
          {data?.as_of ? ` · ${t.etf.asOf(fmtDate(data.as_of, lang))}` : ""}
        </p>
      </div>
      {data ? (
        <ChartPrefsProvider>
          <EtfView data={data} />
        </ChartPrefsProvider>
      ) : (
        <section className="card empty">
          <p style={{ margin: 0 }}>{t.etf.noData}</p>
        </section>
      )}
    </main>
  );
}
