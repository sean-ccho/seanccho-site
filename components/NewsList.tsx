import type { Dict } from "@/lib/i18n";
import type { NewsItem, TickerNews } from "@/lib/news";
import { PanelHint } from "./PanelHint";
import { TickerLink } from "./TickerLink";

// 뉴스 한 줄·종목별 목록 — 서버(오늘의 뉴스·PT-1)와 클라이언트(내계좌 뉴스)가 같이 쓴다. 훅이 없어서 양쪽에서 그대로 그린다.

const SHOWN = 2; // 종목마다 바로 보이는 기사 — 나머지는 접힌 칸 (기본 닫힘)

/** 기사 한 줄: 제목(기계번역이 있으면 번역) 링크 · 원문 · 매체·시각. now = 화면을 그린 시각 (ms). */
export function NewsLine({ item, t, now }: { item: NewsItem; t: Dict; now: number }) {
  const min = item.time ? Math.max(0, Math.round((now - Date.parse(item.time)) / 60000)) : null;
  return (
    <>
      <a className="news-link" href={item.url} target="_blank" rel="noopener noreferrer">
        {item.ko ?? item.title}
      </a>
      {item.ko && <span className="chip news-mt">{t.news.mt}</span>}
      {item.ko && <span className="news-en">{item.title}</span>}
      <span className="news-meta">
        {item.source}
        {item.others > 0 && ` ${t.news.others(item.others)}`}
        {min != null && ` · ${t.status.ago(min)}`}
      </span>
    </>
  );
}

function Items({ items, t, now }: { items: NewsItem[]; t: Dict; now: number }) {
  return (
    <ul className="news-list">
      {items.map((it) => (
        <li className="news-item" key={it.url}>
          <NewsLine item={it} t={t} now={now} />
        </li>
      ))}
    </ul>
  );
}

/** 종목마다: 티커·회사 → 기사 2개 → 나머지는 '기사 n건 더' (닫힌 채로). 3일 안에 없으면 30일 안 마지막 기사. */
export function TickerNewsList({ list, t, now }: { list: TickerNews[]; t: Dict; now: number }) {
  return (
    <div className="news-tickers">
      {list.map((n) => (
        <div className="news-tk" key={n.ticker}>
          <div className="news-tk__head">
            <TickerLink ticker={n.ticker} />
            {n.name && <span className="small muted">{n.name}</span>}
          </div>
          {n.items.length > 0 ? (
            <>
              <Items items={n.items.slice(0, SHOWN)} t={t} now={now} />
              {n.items.length > SHOWN && (
                <details className="news-more">
                  <summary>
                    {t.news.more(n.items.length - SHOWN)}
                    <PanelHint />
                  </summary>
                  <Items items={n.items.slice(SHOWN)} t={t} now={now} />
                </details>
              )}
            </>
          ) : n.last ? (
            <>
              <p className="news-none">
                {t.news.none} · {t.news.lastLabel}
              </p>
              <Items items={[n.last]} t={t} now={now} />
            </>
          ) : (
            <p className="news-none">{t.news.noneAtAll}</p>
          )}
        </div>
      ))}
    </div>
  );
}
