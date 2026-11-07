import Link from "next/link";
import type { Dict, Lang } from "@/lib/i18n";
import type { CongressFeed, CongressTrade } from "@/lib/types";
import { getCongressFeed } from "@/lib/universeServer";
import { congressHref, TradeRow } from "./CongressRow";

/**
 * 국회의원 거래 신고 (2026-11-06) — Project_1 data/congress_trades.py (하원 Clerk PTR, 상원은 아직).
 *  · CongressToday  오늘 탭 '최근 국회의원 거래 신고' — 지난 30일 큰 금액 순 + 지도부 거래 (한 의원은 3줄까지)
 *  · CongressCard   종목 페이지 — 그 종목 지난 1년 (미국 종목만)
 *  1년 전부 · 의원별은 /quant/congress (CongressExplorer). 거래 한 줄은 CongressRow 를 같이 쓴다.
 * 표시 전용 — 신고는 최대 45일 늦고, 신고 뒤 따라 사면 시장과 비슷했다. 법(5 U.S.C. §13107)상 상업 목적으로 쓰지 않는다.
 */

const HOUSE_SEARCH = "https://disclosures-clerk.house.gov/FinancialDisclosure";
const TODAY_N = 10;
const LEADER_EXTRA = 5;
const PER_MEMBER = 3;
const CARD_N = 8;

type Row = CongressFeed["recent"][number];

/**
 * 오늘 탭 칸에 올릴 줄 — 큰 금액(구간 하한) 순 TODAY_N + 그 밖의 지도부 거래 LEADER_EXTRA 까지.
 * 한 의원은 모두 합쳐 PER_MEMBER 줄까지 (한 사람의 큰 신고 하나 · 거래가 많은 지도부 한 명이 칸을 다 채우지 않게).
 */
export function pickToday(feed: CongressFeed): Row[] {
  const byAmount = [...feed.recent].sort((a, b) => (b.low ?? 0) - (a.low ?? 0) || b.filed.localeCompare(a.filed));
  const per = new Map<string, number>();
  const take = (r: Row) => {
    const n = per.get(r.member) ?? 0;
    if (n >= PER_MEMBER) return false;
    per.set(r.member, n + 1);
    return true;
  };
  const top: Row[] = [];
  for (const r of byAmount) {
    if (top.length >= TODAY_N) break;
    if (take(r)) top.push(r);
  }
  const leaders: Row[] = [];
  for (const r of byAmount) {
    if (leaders.length >= LEADER_EXTRA) break;
    if (r.leader && !top.includes(r) && take(r)) leaders.push(r);
  }
  return [...top, ...leaders];
}

export async function CongressToday({ lang, t }: { lang: Lang; t: Dict }) {
  const feed = await getCongressFeed();
  if (!feed?.recent?.length) return null;
  const C = t.congress;
  const rows = pickToday(feed);
  return (
    <section className="cong" aria-labelledby="cong-title">
      <div className="section-head">
        <h2 id="cong-title">{C.todayTitle}</h2>
        <p>
          {C.todaySub(feed.days)} · <Link className="link-strong" href="/quant/congress">{C.allYear} →</Link>
        </p>
      </div>
      <div className="card cong__card">
        <ol className="cong-list">
          {rows.map((r) => (
            <TradeRow key={`${r.doc}-${r.ticker}-${r.date}-${r.owner}-${r.amount}-${r.type}`} r={r} lang={lang} t={t} showTicker />
          ))}
        </ol>
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>
        {C.note} {feed.scanned.length > 0 && `${C.scanned(feed.scanned.length)}. `}
        <a href={HOUSE_SEARCH} target="_blank" rel="noopener noreferrer">{C.official} ↗</a>
      </p>
    </section>
  );
}

/** 종목 페이지 카드 — 그 종목 1년 신고. feed 가 없으면(기능이 아직 안 켜진 밤) 칸째 숨긴다. */
export async function CongressCard({ ticker, trades, lang, t }: { ticker: string; trades: CongressTrade[]; lang: Lang; t: Dict }) {
  const feed = await getCongressFeed();
  if (!feed) return null;
  const C = t.congress;
  const rows = [...trades].sort((a, b) => b.filed.localeCompare(a.filed));
  const recent = rows.filter((r) => Date.parse(r.filed) >= Date.parse(feed.as_of) - 90 * 86_400_000);
  const buys = recent.filter((r) => r.type === "buy").length;
  const sells = recent.filter((r) => r.type === "sell").length;
  const members = new Set(recent.map((r) => r.member)).size;
  return (
    <section className="card" aria-labelledby="cong-card-title">
      <div className="section-head">
        <h2 id="cong-card-title">{C.cardTitle}</h2>
        <p>{C.cardSub}</p>
      </div>
      {rows.length ? (
        <>
          <p className="small" style={{ margin: "6px 0 0" }}>{C.summary(buys, sells, members)}</p>
          <ol className="cong-list">
            {rows.slice(0, CARD_N).map((r, i) => (
              <TradeRow key={`${r.url}-${i}`} r={r} lang={lang} t={t} showTicker={false} />
            ))}
          </ol>
          {rows.length > CARD_N && (
            <details className="cong-more">
              <summary>{C.more(rows.length - CARD_N)}</summary>
              <ol className="cong-list">
                {rows.slice(CARD_N).map((r, i) => (
                  <TradeRow key={`${r.url}-m${i}`} r={r} lang={lang} t={t} showTicker={false} />
                ))}
              </ol>
            </details>
          )}
        </>
      ) : (
        <p className="muted" style={{ margin: "8px 0 0" }}>{C.none}</p>
      )}
      <p className="tiny muted" style={{ margin: "10px 0 0" }}>
        {C.note}{" "}
        <Link className="link-strong" href={congressHref(ticker)}>{C.byMember} →</Link>
      </p>
    </section>
  );
}
