import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { LangToggle } from "@/components/LangToggle";
import { QuantNav } from "@/components/QuantNav";
import { getDashboard } from "@/lib/dashboard";
import { fmtDate } from "@/lib/format";
import { getT } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { default: t.today.metaTitle, template: `%s · ${t.today.metaTitle}` },
    robots: { index: false, follow: false },
  };
}

export default async function QuantLayout({ children }: { children: React.ReactNode }) {
  const [data, { lang, t }] = await Promise.all([getDashboard(), getT()]);
  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href="/" className="brand">
            <BrandMark />
            <span>PT-1</span>
            <span className="brand__tag">{t.nav.personal}</span>
          </Link>
          <QuantNav />
          <div className="q-status">
            <span className="q-status__dot" aria-hidden="true" />
            <span>{data ? t.status.asOf(fmtDate(data.price_date ?? data.bar_date, lang, true)) : t.status.failed}</span>
          </div>
          <LangToggle />
        </div>
      </header>
      {children}
    </>
  );
}
