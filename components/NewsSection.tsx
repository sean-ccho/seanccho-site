import { Suspense } from "react";
import { NewsLine, TickerNewsList } from "./NewsList";
import type { AccountRow } from "@/lib/account";
import { stockInfo } from "@/lib/dashboard";
import { fmtDateTime, isCadListing } from "@/lib/format";
import { term, type Dict, type Lang } from "@/lib/i18n";
import { getMarketNews, getTickerNews, getTopNews, type NewsItem, type NewsTarget, type TopFeed } from "@/lib/news";
import type { Dashboard } from "@/lib/types";
import { getUniverseStock } from "@/lib/universeServer";

/**
 * 뉴스 칸들 (2026-10-21, 10-29 나눔).
 *  · 오늘 페이지(TodayNews): 미국 증시 TOP 10(위에 오늘 시황 한 줄) · 전세계 · 캐나다 · 한국 TOP 10 네 칸 (10-31 캐나다 · 한국).
 *  · 내계좌 › PT-1 탭(Pt1News): PT-1 보유종목 뉴스.
 *  · 내계좌 탭(AccountNewsCard): 내계좌 보유종목 뉴스 — 비밀번호 뒤 페이지라 서버가 바로 그린다.
 * 칸마다 따로 <Suspense> 라 뉴스가 늦거나 실패해도 나머지 화면은 먼저 뜬다.
 */
export function TodayNews({ lang, t }: { lang: Lang; t: Dict }) {
  return (
    <div className="row">
      <Suspense fallback={<NewsSkeleton title={t.news.top} t={t} />}>
        <MarketNewsCard lang={lang} t={t} />
      </Suspense>
      {TOP_CARDS.map((feed) => (
        <Suspense key={feed} fallback={<NewsSkeleton title={t.news[feed]} t={t} />}>
          <TopNewsCard feed={feed} lang={lang} t={t} />
        </Suspense>
      ))}
    </div>
  );
}

const TOP_CARDS: TopFeed[] = ["world", "ca", "kr"];

export function Pt1News({ data, lang, t }: { data: Dashboard; lang: Lang; t: Dict }) {
  const acct = data.accounts.find((a) => a.key === "pt1") ?? data.accounts[0];
  const label = t.news.pt1(term(lang, acct?.label ?? "PT-1"));
  return (
    <Suspense fallback={<NewsSkeleton title={label} t={t} />}>
      <HoldingNewsCard data={data} title={label} lang={lang} t={t} />
    </Suspense>
  );
}

export function AccountNews({ rows, lang, t }: { rows: AccountRow[]; lang: Lang; t: Dict }) {
  return (
    <Suspense fallback={<NewsSkeleton title={t.news.account} t={t} />}>
      <AccountNewsCard rows={rows} lang={lang} t={t} />
    </Suspense>
  );
}

/** 칸 안에 번역한 기사가 하나라도 있으면 머리에 '기계번역' 칩 한 번 (기사마다 붙이면 시끄럽다). */
function MtChip({ items, t }: { items: NewsItem[]; t: Dict }) {
  return items.some((x) => x.ko) ? <span className="chip news-mt">{t.news.mt}</span> : null;
}

function TopList({ items, t, now }: { items: NewsItem[]; t: Dict; now: number }) {
  if (!items.length) return <p className="news-none">{t.news.failed}</p>;
  return (
    <ol className="news-list news-list--num">
      {items.map((it) => (
        <li className="news-item" key={it.url}>
          <NewsLine item={it} t={t} now={now} />
        </li>
      ))}
    </ol>
  );
}

async function MarketNewsCard({ lang, t }: { lang: Lang; t: Dict }) {
  const market = await getMarketNews(lang);
  const now = Date.now();
  return (
    <section className="card" aria-labelledby="news-market-title">
      <div className="section-head">
        <h2 id="news-market-title">{t.news.top}</h2>
        <p>
          {market.at ? t.news.asOf(fmtDateTime(market.at, lang)) : t.news.every}
          <MtChip items={market.wrap ? [market.wrap, ...market.top] : market.top} t={t} />
        </p>
      </div>
      {market.wrap && (
        <p className="news-wrap">
          <span className="news-wrap__label">{t.news.wrap}</span>
          <span className="news-wrap__body">
            <NewsLine item={market.wrap} t={t} now={now} />
          </span>
        </p>
      )}
      <div className="news-top">
        <TopList items={market.top} t={t} now={now} />
      </div>
    </section>
  );
}

async function TopNewsCard({ feed, lang, t }: { feed: TopFeed; lang: Lang; t: Dict }) {
  const news = await getTopNews(feed, lang);
  const now = Date.now();
  return (
    <section className="card" aria-labelledby={`news-${feed}-title`}>
      <div className="section-head">
        <h2 id={`news-${feed}-title`}>{t.news[feed]}</h2>
        <p>
          {news.at ? t.news.asOf(fmtDateTime(news.at, lang)) : t.news.every}
          <MtChip items={news.top} t={t} />
        </p>
      </div>
      <div className="news-top">
        <TopList items={news.top} t={t} now={now} />
      </div>
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
  return <TickerNewsCard id="news-pt1-title" title={title} targets={targets} lang={lang} t={t} />;
}

async function AccountNewsCard({ rows, lang, t }: { rows: AccountRow[]; lang: Lang; t: Dict }) {
  // 보유 중인 줄(매도일 빈 줄, 샘플 줄 제외)만, 같은 티커는 한 번 (나눠 판 줄이 여러 개일 수 있다)
  const seen = new Set<string>();
  const open = rows.filter((r) => {
    const tk = r.input.ticker.trim().toUpperCase();
    if (r.closed || r.sample || !tk || seen.has(tk)) return false;
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
  return <TickerNewsCard id="news-account-title" title={t.news.account} targets={targets} lang={lang} t={t} />;
}

async function TickerNewsCard({ id, title, targets, lang, t }: {
  id: string; title: string; targets: NewsTarget[]; lang: Lang; t: Dict;
}) {
  const list = await getTickerNews(targets, lang);
  const now = Date.now();
  return (
    <section className="card" aria-labelledby={id}>
      <h2 id={id} className="news-card-title">
        {title}
        <MtChip items={list.flatMap((n) => n.items)} t={t} />
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
