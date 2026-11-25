import type { MetadataRoute } from "next";
import { ADMIN_PATHS } from "@/lib/authPaths";
import { QUANT_INDEXABLE, SITE_URL } from "@/lib/siteUrl";

/**
 * robots.txt (2026-11-25) — 공개 화면은 긁어도 되고, 관리자 화면(내계좌 묶음 · 관리) · 옛 매매일지 주소 · API 는 빼라고.
 * 검색 노출을 꺼도(lib/siteUrl.ts QUANT_INDEXABLE = false) 공개 화면 긁기는 막지 않는다 — 구글이 다시 읽어 noindex 를 봐야
 * 이미 올라간 페이지가 검색에서 빠진다 (막으면 주소만 남을 수 있다). 로그인 화면도 같은 이유로 막지 않는다.
 * sitemap 줄은 검색 노출이 켜졌을 때만.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", ...ADMIN_PATHS, "/quant/journal"] },
    ...(QUANT_INDEXABLE ? { sitemap: `${SITE_URL}/sitemap.xml` } : {}),
  };
}
