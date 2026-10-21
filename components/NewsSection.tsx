import { Suspense } from "react";
import { AccountNews } from "./AccountNews";
import { NewsLine, TickerNewsList } from "./NewsList";
import { stockInfo } from "@/lib/dashboard";
import { fmtDateTime } from "@/lib/format";
import { term, type Dict, type Lang } from "@/lib/i18n";
import { getMarketNews, getTickerNews, type NewsTarget } from "@/lib/news";
import type { Dashboard } from "@/lib/types";
import { getUniverseStock } from "@/lib/universeServer";

/**
 * 오늘 페이지 '오늘의 뉴스' (2026-10-21) — 오늘 시황(한국 언론) + 미국 증시 TOP 5, 그 아래 PT-1 보유종목 · 내계좌 두 칸.
 * 시장·PT-1 칸은 따로 <Suspense> 라 뉴스가 늦거나 실패해도 나머지 화면은 먼저 뜬다.
 * 내계좌 칸은 비밀번호 뒤라 서버가 그리지 않고, 브라우저가 /quant/account/news 를 따로 부른다 (AccountNews) —
 * Suspense 밖에 둬서 페이지가 뜨자마자 부른다.
 */
export function NewsSection({ data, lang, t }: { data: Dashboard; lang: Lang; t: Dict }) {
  const acct = data.accounts.find((a) => a.key === "pt1") ?? data.accounts[0];
  const label = t.news.pt1(term(lang, acct?.label ?? "PT-1"));
  return (
    <>
      <Suspense fallback={<NewsSkeleton title={t.news.title} t={t} />}>
        <MarketNewsCard lang={lang} t={t} />
      </Suspense>
      <div className="row">
        <Suspense fallback={<NewsSkeleton title={label} t={t} />}>
          <HoldingNewsCard data={data} title={label} lang={lang} t={t} />
        </Suspense>
        <AccountNews />
      </div>
    </>
  );
}

async function MarketNewsCard({ lang, t }: { lang: Lang; t: Dict }) {
  const market = await getMarketNews(lang);
  const now = Date.now();
  return (
    <section className="card" aria-labelledby="news-title">
      <div className="section-head">
        <h2 id="news-title">{t.news.title}</h2>
        <p>{market.at ? t.news.asOf(fmtDateTime(market.at, lang)) : t.news.every}</p>
      </div>
      {market.wrap && (
        <p className="news-wrap">
          <span className="news-wrap__label">{t.news.wrap}</span>
          <span className="news-wrap__body">
            <NewsLine item={market.wrap} t={t} now={now} />
          </span>
        </p>
      )}
      <h3 className="news-h3">{t.news.top}</h3>
      {market.top.length > 0 ? (
        <ol className="news-list news-list--num">
          {market.top.map((it) => (
            <li className="news-item" key={it.url}>
              <NewsLine item={it} t={t} now={now} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="news-none">{t.news.failed}</p>
      )}
      <p className="tiny muted news-note">{t.news.note}</p>
    </section>
  );
}

async function HoldingNewsCard({ data, title, lang, t }: { data: Dashboard; title: string; lang: Lang; t: Dict }) {
  const acct = data.accounts.find((a) => a.key === "pt1") ?? data.accounts[0];
  // 회사 이름: 포지션 → dashboard 종목 정보 → 전체분석 종목 파일 (앞의 둘이 빈 종목이 있다)
  const targets: NewsTarget[] = await Promise.all(
    (acct?.positions ?? []).map(async (p) => ({
      ticker: p.ticker,
      name: p.company ?? stockInfo(data, p.ticker)?.company ?? (await getUniverseStock(p.ticker))?.company ?? null,
      cad: false,
    })),
  );
  const list = await getTickerNews(targets, lang);
  const now = Date.now();
  return (
    <section className="card" aria-labelledby="news-pt1-title">
      <h2 id="news-pt1-title" className="news-card-title">
        {title}
      </h2>
      {list.length > 0 ? <TickerNewsList list={list} t={t} now={now} /> : <p className="news-none">{t.news.noHoldings}</p>}
    </section>
  );
}

/** 뉴스를 받는 동안 같은 자리를 잡아 두는 칸 (화면이 덜 밀리게). */
export function NewsSkeleton({ title, t }: { title: string; t: Dict }) {
  return (
    <section className="card news-skeleton" aria-busy="true">
      <h2 className="news-card-title">{title}</h2>
      <p className="news-none">{t.news.loading}</p>
    </section>
  );
}
