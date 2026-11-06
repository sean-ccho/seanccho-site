import Link from "next/link";
import { fmtDate, stockHref } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { shortCompany } from "@/lib/market";
import type { CongressFeed, CongressTrade } from "@/lib/types";
import { getCongressFeed } from "@/lib/universeServer";

/**
 * 국회의원 거래 신고 (2026-11-06) — Project_1 data/congress_trades.py (하원 Clerk PTR, 상원은 아직).
 *  · CongressToday  오늘 탭 '최근 국회의원 거래 신고' — 지난 30일 큰 금액 순 + 지도부 거래는 빠짐없이
 *  · CongressCard   종목 페이지 — 그 종목 지난 1년 (미국 종목만)
 * 표시 전용 — 신고는 최대 45일 늦고, 신고 뒤 따라 사면 시장과 비슷했다. 법(5 U.S.C. §13107)상 상업 목적으로 쓰지 않는다.
 */

const HOUSE_SEARCH = "https://disclosures-clerk.house.gov/FinancialDisclosure";
const TODAY_N = 10;
const LEADER_EXTRA = 5;
const CARD_N = 8;

type Row = CongressTrade & { ticker?: string; asset?: string; doc?: string };

function typeLabel(r: Row, t: Dict): string {
  const C = t.congress;
  return r.type === "buy" ? C.buy : r.type === "sell" ? (r.partial ? C.sellPartial : C.sell) : C.exchange;
}

/** 의원 이름 · 정당-주 · 지도부 · 소유자 */
function Member({ r, t }: { r: Row; t: Dict }) {
  const C = t.congress;
  const party = r.party ? C.party[r.party] ?? r.party : null;
  return (
    <span className="cong-member">
      <b>{r.member}</b>
      {(party || r.state) && <span className="tiny muted">{[party, r.state].filter(Boolean).join("·")}</span>}
      {r.leader && (
        <span className="badge badge--held cong-leader" title={r.leader}>
          {C.leader}
        </span>
      )}
      {r.owner !== "self" && <span className="chip cong-owner">{C.owner[r.owner] ?? r.owner}</span>}
    </span>
  );
}

function TradeRow({ r, lang, t, showTicker }: { r: Row; lang: Lang; t: Dict; showTicker: boolean }) {
  const C = t.congress;
  const up = r.type === "buy";
  return (
    <li className="cong-row">
      <span className="cong-row__main">
        <Member r={r} t={t} />
        <span className="cong-row__what">
          <span className={`badge ${up ? "badge--good" : r.type === "sell" ? "badge--bad" : ""}`}>{typeLabel(r, t)}</span>
          {showTicker && r.ticker && (
            <>
              <Link className="tick" href={stockHref(r.ticker)}>{r.ticker}</Link>
              {r.asset && <span className="tiny muted cong-asset">{assetName(r.asset)}</span>}
            </>
          )}
          {r.atype === "OP" && <span className="chip">{C.option}</span>}
          <span className="num small">{r.amount}</span>
        </span>
      </span>
      <span className="tiny muted cong-row__when">
        {r.date && r.lag != null ? C.lag(fmtDate(r.date, lang), r.lag) : C.filed(fmtDate(r.filed, lang))}
        {" · "}
        <a href={r.url} target="_blank" rel="noopener noreferrer">{C.source} ↗</a>
      </span>
    </li>
  );
}

/**
 * 오늘 탭 칸에 올릴 줄 — 큰 금액(구간 하한) 순 TODAY_N (한 의원은 PER_MEMBER 줄까지 — 한 사람의 큰 신고 하나가 칸을 다 채우지
 * 않게) + 그 밖의 지도부 거래 LEADER_EXTRA 까지.
 */
const PER_MEMBER = 3;
export function pickToday(feed: CongressFeed): Row[] {
  const byAmount = [...feed.recent].sort((a, b) => (b.low ?? 0) - (a.low ?? 0) || b.filed.localeCompare(a.filed));
  const per = new Map<string, number>();
  const top: Row[] = [];
  for (const r of byAmount) {
    if (top.length >= TODAY_N) break;
    const n = per.get(r.member) ?? 0;
    if (n >= PER_MEMBER) continue;
    per.set(r.member, n + 1);
    top.push(r);
  }
  const leaders = byAmount.filter((r) => r.leader && !top.includes(r)).slice(0, LEADER_EXTRA);
  return [...top, ...leaders];
}

/** 'Alphabet Inc. - Class C Capital Stock' → 'Alphabet Inc.' · 'Datadog, Inc. - Class A Common Stock' → 'Datadog' */
function assetName(asset: string): string {
  return shortCompany(asset.split(" - ")[0].replace(/\s+(Class [A-C]\s+)?(Common|Capital|Ordinary)\s+(Stock|Shares).*$/i, ""));
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
        <p>{C.todaySub(feed.days)}</p>
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
export async function CongressCard({ trades, lang, t }: { trades: CongressTrade[]; lang: Lang; t: Dict }) {
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
      <p className="tiny muted" style={{ margin: "10px 0 0" }}>{C.note}</p>
    </section>
  );
}
