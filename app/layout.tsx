import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";
import { LangProvider } from "@/components/LangProvider";
import { ScrollTop } from "@/components/ScrollTop";
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

export const metadata: Metadata = {
  title: { default: profile.name, template: `%s · ${profile.name}` },
};

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
        </LangProvider>
      </body>
    </html>
  );
}
