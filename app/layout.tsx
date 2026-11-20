import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { LangProvider } from "@/components/LangProvider";
import { ScrollTop } from "@/components/ScrollTop";
import { VisitTracker } from "@/components/VisitTracker";
import { profile } from "@/content/profile";
import { getLang } from "@/lib/lang";
import "./globals.css";

const plexKr = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plex-kr",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

/** 링크 미리보기 그림 · 주소의 기준 — Vercel 운영 주소 (없으면 seancho.vercel.app). */
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://seancho.vercel.app";

/**
 * 탭 제목 + 링크 미리보기 (OpenGraph · X 카드, 2026-11-19). 글은 content/profile.ts 의 share, 그림은 app/opengraph-image.tsx.
 * 아래 페이지들은 openGraph 를 따로 정하지 않아 여기 것을 그대로 물려받는다 (정하면 통째로 덮어써 그림이 빠진다).
 */
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const { share } = profile;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: profile.name, template: `%s · ${profile.name}` },
    description: share.description[lang],
    openGraph: {
      type: "website",
      siteName: share.siteName,
      title: share.title[lang],
      description: share.description[lang],
      locale: lang === "ko" ? "ko_KR" : "en_US",
    },
    twitter: { card: "summary_large_image", title: share.title[lang], description: share.description[lang] },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#121316" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${plexKr.variable} ${plexMono.variable}`}>
      <body>
        <LangProvider lang={lang}>
          {children}
          <ScrollTop />
          <VisitTracker />
        </LangProvider>
        <Analytics />
      </body>
    </html>
  );
}
