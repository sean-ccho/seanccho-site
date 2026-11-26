"use client";

import { useState } from "react";
import { useT } from "./LangProvider";
import { NewsTitle } from "./NewsTitle";
import { TickerLink } from "./TickerLink";
import type { NewsItem, TickerNews } from "@/lib/news";

type Line = { tk: string; item: NewsItem; old: boolean };

/**
 * 내계좌 보유종목 뉴스 (2026-11-26 사용자 시안) — 머리 오른쪽 종목 버튼으로 거르기.
 * '전체' = 종목마다 가장 최근 기사 하나 (보유 순서), 종목을 누르면 그 종목 기사 전부 (최근 3일 최대 5개).
 * 3일 안 기사가 없으면 30일 안 마지막 기사에 '지난 기사' 표시. 기사 줄은 [티커 · 매체 · 시각] 다음 제목 (번역이면 원문 한 줄).
 * 서버(NewsSection AccountNewsCard)가 기사를 받아 넘기고, 여기서는 고르기만 한다.
 */
export function AccountNewsFeed({ id, title, list, mt, now }: {
  id: string;
  title: string;
  list: TickerNews[];
  mt: boolean; // 번역한 제목이 있나 — 머리에 '기계번역' 칩 한 번
  now: number; // 서버가 그린 시각 (ms) — 'n시간 전'
}) {
  const { t } = useT();
  const [pick, setPick] = useState<string>("all");
  const cur = pick === "all" ? null : list.find((n) => n.ticker === pick) ?? null;
  const latest = (n: TickerNews): Line[] =>
    n.items[0] ? [{ tk: n.ticker, item: n.items[0], old: false }] : n.last ? [{ tk: n.ticker, item: n.last, old: true }] : [];
  const lines: Line[] = cur
    ? cur.items.length ? cur.items.map((item) => ({ tk: cur.ticker, item, old: false })) : latest(cur)
    : list.flatMap(latest);
  const none = (cur ? [cur] : list).filter((n) => !n.items.length && !n.last).map((n) => n.ticker);
  const ago = (iso: string | null) => (iso ? t.status.ago(Math.max(0, Math.round((now - Date.parse(iso)) / 60000))) : null);

  return (
    <section className="card acct-news" aria-labelledby={id}>
      <div className="acct-card-head">
        <h2 id={id}>{title}</h2>
        {mt && <span className="chip news-mt">{t.news.mt}</span>}
        {list.length > 1 && (
          <div className="acct-news__tabs" role="group" aria-label={t.news.tabsAria}>
            <button type="button" aria-pressed={pick === "all"} onClick={() => setPick("all")} title={t.news.allHint}>
              {t.news.allTab}
            </button>
            {list.map((n) => (
              <button key={n.ticker} type="button" className="tick" aria-pressed={pick === n.ticker} onClick={() => setPick(n.ticker)}>
                {n.ticker}
              </button>
            ))}
          </div>
        )}
      </div>
      {list.length === 0 ? (
        <p className="news-none">{t.news.noHoldings}</p>
      ) : (
        <ul className="acct-news__list">
          {lines.map(({ tk, item, old }) => (
            <li key={`${tk}-${item.url}`} className="acct-news__item">
              <div className="acct-news__meta">
                <TickerLink ticker={tk} />
                <span>
                  {item.source}
                  {item.others > 0 && ` ${t.news.others(item.others)}`}
                  {item.time && ` · ${ago(item.time)}`}
                </span>
                {old && <span className="badge badge--mid">{t.news.oldTag}</span>}
              </div>
              <NewsTitle item={item} />
            </li>
          ))}
          {none.length > 0 && (
            <li className="acct-news__item acct-news__item--none">
              <span className="news-none">{t.news.noneAtAll} · {none.join(" · ")}</span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
