import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { QuantNav } from "@/components/QuantNav";
import { getDashboard } from "@/lib/dashboard";
import { dateKo } from "@/lib/format";

export const metadata: Metadata = {
  title: { default: "퀀트 대시보드", template: "%s · 퀀트 대시보드" },
  robots: { index: false, follow: false },
};

export default async function QuantLayout({ children }: { children: React.ReactNode }) {
  const data = await getDashboard();
  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href="/" className="brand">
            <BrandMark />
            <span>PT-1</span>
            <span className="brand__tag">개인용</span>
          </Link>
          <QuantNav />
          <div className="q-status">
            <span className="q-status__dot" aria-hidden="true" />
            <span>
              {data
                ? `${dateKo(data.price_date ?? data.bar_date, true)} 종가 기준 · 매일 저녁 자동 갱신`
                : "데이터를 불러오지 못했어요"}
            </span>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
