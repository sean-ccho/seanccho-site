import { readAccount } from "@/lib/account";
import { basicAuthOk } from "@/lib/auth";
import { isCadListing } from "@/lib/format";
import { getLang } from "@/lib/lang";
import { getTickerNews, type NewsTarget } from "@/lib/news";
import { sheetsConfigured } from "@/lib/sheets";
import { getUniverseStock } from "@/lib/universeServer";

/**
 * 오늘 페이지 '내계좌 보유종목 뉴스' 칸이 부르는 주소 (2026-10-21) — components/AccountNews.tsx.
 * proxy.ts 가 /quant/account/* 를 이미 비밀번호로 막지만 여기서도 한 번 더 본다. 보유 종목은 실제 돈 정보라
 * 오늘 페이지(공개)에 서버가 그려 넣지 않고, 이 응답도 어디에도 캐시되지 않게 한다. 돌려주는 건 티커·회사 이름·기사뿐.
 *
 *   GET /quant/account/news  → { ok: true, tickers: TickerNews[] } · 401 비밀번호 없음 · 503 설정 없음 · 502 시트 실패
 */
export const dynamic = "force-dynamic";

// 이 브라우저에만 — CDN·공유 캐시에 남지 않게 (Vary 는 Next 가 자기 값으로 덮어써서 안 쓴다)
const HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request): Promise<Response> {
  if (!basicAuthOk(request.headers.get("authorization"), process.env.SITE_PASSWORD)) {
    return Response.json({ ok: false, reason: "auth" }, { status: 401, headers: HEADERS });
  }
  if (!sheetsConfigured()) {
    return Response.json({ ok: false, reason: "config" }, { status: 503, headers: HEADERS });
  }
  let rows;
  try {
    ({ rows } = await readAccount());
  } catch (err) {
    console.error("[account-news] 시트 읽기 실패", err instanceof Error ? err.message : err);
    return Response.json({ ok: false, reason: "sheet" }, { status: 502, headers: HEADERS });
  }

  // 보유 중인 줄(매도일 빈 줄)만, 같은 티커는 한 번 (나눠 판 줄이 여러 개일 수 있다)
  const seen = new Set<string>();
  const open = rows.filter((r) => {
    const tk = r.input.ticker.trim().toUpperCase();
    if (r.closed || !tk || seen.has(tk)) return false;
    seen.add(tk);
    return true;
  });
  const targets: NewsTarget[] = await Promise.all(
    open.map(async (r) => {
      const ticker = r.input.ticker.trim().toUpperCase();
      const cad = isCadListing(ticker, r.input.exchange);
      // 회사 이름: 시트 회사명 → 전체분석 종목 파일 (캐나다 상장은 전체분석에 없다)
      const name = r.input.company.trim() || (cad ? null : (await getUniverseStock(ticker))?.company) || null;
      return { ticker, name, cad };
    }),
  );
  const tickers = await getTickerNews(targets, await getLang());
  return Response.json({ ok: true, tickers }, { headers: HEADERS });
}
