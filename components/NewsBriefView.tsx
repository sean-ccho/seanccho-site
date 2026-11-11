"use client";

import { useMemo, useState } from "react";
import { Hint } from "./Hint";
import { useT } from "./LangProvider";
import type { Dict } from "@/lib/i18n";
import { useKoFallback } from "@/lib/mtBrowser";
import type { NewsItem } from "@/lib/news";
import { NEWS_TOPICS, type NewsTopic } from "@/lib/newsTopics";

/**
 * 오늘 탭 '오늘의 핵심 뉴스' 카드 (2026-11-10) — 미국 증시 · 전세계 · [한국 | 캐나다] 세 칸, 칸마다 TOP 5 (눌러서 10개).
 * 머리의 주제 칩(#거시경제 · #빅테크 · #지정학 · #수급)은 세 칸을 같이 거른다 — 거를 때는 10개 중 맞는 기사 전부, 순위 번호는 구글 순서 그대로.
 * 칩 앞 '주제별 보기'(누르면 설명) · 칩마다 맞는 기사 수 (2026-11-10 — 칩만 있으면 무슨 버튼인지 몰라서).
 * 폰은 세 칸을 쌓지 않고 위 고르기 막대로 한 칸씩 (미국 · 전세계 · 한국 · 캐나다).
 * 기사 · 기계번역은 서버(NewsSection.NewsBrief)가 받아 넘기고, 여기서는 고르기 상태만 — 저장하지 않아 서버 HTML 과 같은 '전체 · 미국 · 한국'으로 시작한다.
 * 서버가 구글에 막혀 번역을 못 한 제목(mt)은 브라우저가 한 번 더 번역해 채운다 (lib/mtBrowser.ts, 2026-11-10).
 */

export type BriefItem = NewsItem & { rank: number; topics: NewsTopic[] };
export type BriefColKey = "us" | "world" | "kr" | "ca";
type TopicPick = NewsTopic | "all";
type PhoneCol = "us" | "world" | "local";

const SHOWN = 5;

export function NewsBriefView({ cols, wrap, at, now }: {
  cols: Record<BriefColKey, BriefItem[]>;
  /** 오늘 시황 한 줄 (한국 언론 · EN 은 영어 시황 기사) */
  wrap: BriefItem | null;
  /** 구글이 목록을 준 시각 (토론토, 이미 글자) */
  at: string | null;
  /** 서버가 그린 시각 (ms) — 'n분 전'이 서버 · 브라우저에서 같게 */
  now: number;
}) {
  const { t } = useT();
  const B = t.brief;
  const [topic, setTopic] = useState<TopicPick>("all");
  const [open, setOpen] = useState<Partial<Record<BriefColKey, boolean>>>({});
  const [local, setLocal] = useState<"kr" | "ca">("kr");
  const [phone, setPhone] = useState<PhoneCol>("us");
  const koOf = useKoFallback([...cols.us, ...cols.world, ...cols.kr, ...cols.ca, wrap]);
  const toggle = (k: BriefColKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const pickLocal = (k: "kr" | "ca") => {
    setLocal(k);
    setPhone("local");
  };
  // 칩 숫자 = 지금 보이는 세 칸(미국 · 전세계 · 고른 한국/캐나다, 칸마다 10개)에서 그 주제 기사 수 — 무엇을 거르는 버튼인지 바로 보이게
  const counts = useMemo(() => {
    const n: Record<NewsTopic, number> = { macro: 0, tech: 0, geo: 0, flow: 0 };
    for (const list of [cols.us, cols.world, cols[local]]) for (const it of list) for (const k of it.topics) n[k] += 1;
    return n;
  }, [cols, local]);

  const phoneBtns: { key: string; label: string; on: boolean; go: () => void }[] = [
    { key: "us", label: B.colUsShort, on: phone === "us", go: () => setPhone("us") },
    { key: "world", label: B.colWorld, on: phone === "world", go: () => setPhone("world") },
    { key: "kr", label: B.colKr, on: phone === "local" && local === "kr", go: () => pickLocal("kr") },
    { key: "ca", label: B.colCa, on: phone === "local" && local === "ca", go: () => pickLocal("ca") },
  ];

  return (
    <section className="card brief-card nb" aria-labelledby="nb-title" data-phone={phone}>
      <div className="brief-head">
        <div className="brief-head__text">
          <h2 id="nb-title">
            {B.newsTitle} <span className="brief-en">{B.newsEn}</span>
          </h2>
          <p>{at ? t.news.asOf(at) : t.news.every}</p>
        </div>
        <div className="brief-head__side nb-topics" role="group" aria-label={B.topicAria}>
          <Hint text={B.topicHelp} className="nb-topics__label">{B.topicLabel}</Hint>
          {(["all", ...NEWS_TOPICS] as TopicPick[]).map((k) => (
            <button key={k} type="button" className="nb-topic" aria-pressed={topic === k} onClick={() => setTopic(k)}>
              {B.topics[k]}
              {k !== "all" && <span className={`nb-topic__n num${counts[k] ? "" : " nb-topic__n--zero"}`}>{counts[k]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="tseg nb-phone" role="group" aria-label={B.colAria}>
        {phoneBtns.map((b) => (
          <button key={b.key} type="button" aria-pressed={b.on} onClick={b.go}>
            {b.label}
          </button>
        ))}
      </div>

      <div className="nb-cols">
        <NewsCol id="us" dot="us" title={B.colUs} items={cols.us} topic={topic} open={!!open.us} onToggle={() => toggle("us")}
          wrap={topic === "all" ? wrap : null} koOf={koOf} now={now} t={t} />
        <NewsCol id="world" dot="world" title={B.colWorld} items={cols.world} topic={topic} open={!!open.world}
          onToggle={() => toggle("world")} koOf={koOf} now={now} t={t} />
        <NewsCol id="local" items={cols[local]} topic={topic} open={!!open[local]} onToggle={() => toggle(local)} koOf={koOf}
          now={now} t={t}
          head={
            <div className="tseg nb-local" role="group" aria-label={B.localAria}>
              {(["kr", "ca"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={local === k} onClick={() => setLocal(k)}>
                  {k === "kr" ? B.colKrLong : B.colCaLong}
                </button>
              ))}
            </div>
          } />
      </div>
      <p className="tiny muted brief-note">{B.newsNote}</p>
    </section>
  );
}

function NewsCol({ id, dot, title, head, items, topic, open, onToggle, wrap, koOf, now, t }: {
  id: PhoneCol;
  dot?: "us" | "world";
  title?: string;
  /** 제목 대신 넣을 것 (한국 · 캐나다 고르기) */
  head?: React.ReactNode;
  items: BriefItem[];
  topic: TopicPick;
  open: boolean;
  onToggle: () => void;
  wrap?: BriefItem | null;
  /** 한국어 제목 — 서버 번역, 없으면 브라우저 번역 (없으면 null = 원문) */
  koOf: (x: NewsItem) => string | null;
  now: number;
  t: Dict;
}) {
  const B = t.brief;
  const all = topic === "all";
  const shown = all ? (open ? items : items.slice(0, SHOWN)) : items.filter((x) => x.topics.includes(topic));
  const mt = items.some((x) => koOf(x)) || (wrap ? !!koOf(wrap) : false);
  const wrapKo = wrap ? koOf(wrap) : null;
  return (
    <div className="nb-col" data-col={id}>
      <div className="nb-col__head">
        {head ?? (
          <h3>
            <span className={`nb-dot nb-dot--${dot}`} aria-hidden="true" />
            {title}
          </h3>
        )}
        {mt && <span className="chip news-mt">{t.news.mt}</span>}
        <span className="nb-top">{all ? B.topN(open ? items.length : Math.min(SHOWN, items.length)) : B.topicN(shown.length)}</span>
      </div>
      {wrap && (
        <div className="nb-wrap">
          <span className="nb-wrap__label">{t.news.wrap}</span>
          <a className="nb-link" href={wrap.url} target="_blank" rel="noopener noreferrer" title={wrapKo ? wrap.title : undefined}>
            {wrapKo ?? wrap.title}
          </a>
          <span className="nb-meta">{metaText(wrap, now, t)}</span>
        </div>
      )}
      {items.length === 0 ? (
        <p className="nb-none">{t.news.failed}</p>
      ) : shown.length === 0 ? (
        <p className="nb-none">{B.noneTopic}</p>
      ) : (
        <ol className="nb-list">
          {shown.map((it) => {
            const ko = koOf(it);
            return (
              <li key={it.url} className="nb-item">
                <span className="nb-rank num" aria-hidden="true">{it.rank}</span>
                <span className="nb-body">
                  <a className="nb-link" href={it.url} target="_blank" rel="noopener noreferrer" title={ko ? it.title : undefined}>
                    {ko ?? it.title}
                  </a>
                  <span className="nb-meta">{metaText(it, now, t)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {all && items.length > SHOWN && (
        <button type="button" className="nb-more" aria-expanded={open} onClick={onToggle}>
          {open ? `${B.showLess} ↑` : `${B.showAll(items.length)} ↓`}
        </button>
      )}
    </div>
  );
}

/** '로이터 외 4곳 · 38분 전' */
function metaText(it: NewsItem, now: number, t: Dict): string {
  const min = it.time ? Math.max(0, Math.round((now - Date.parse(it.time)) / 60000)) : null;
  return [it.source + (it.others > 0 ? ` ${t.news.others(it.others)}` : ""), min != null ? t.status.ago(min) : null]
    .filter(Boolean)
    .join(" · ");
}
