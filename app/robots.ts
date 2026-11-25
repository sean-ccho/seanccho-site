import type { MetadataRoute } from "next";
import { ADMIN_PATHS } from "@/lib/authPaths";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * robots.txt (2026-11-25 검색 노출) — 공개 화면은 다 긁어도 되고, 관리자 화면(내계좌 묶음 · 관리) · 옛 매매일지 주소 · API 는 빼라고.
 * 로그인 화면은 막지 않는다 — 긁어서 noindex 를 봐야 검색에서 빠진다 (막으면 주소만 검색에 남을 수 있다).
 * 검색 노출을 다시 끄려면 app/quant/layout.tsx 의 robots 를 index: false 로 (이 파일만 바꾸면 이미 올라간 페이지가 안 빠진다).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", ...ADMIN_PATHS, "/quant/journal"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
