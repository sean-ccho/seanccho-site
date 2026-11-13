import Link from "next/link";
import {
  amountText, badTradeDate, cmpRecent, sameListHref, TODAY_MIN, TODAY_N, TODAY_PER_MEMBER,
} from "@/lib/congress";
import { bigUsd, ceoCaUrl, fmtDate, openinsiderUrl, stockHref, tone } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import { shortCompany } from "@/lib/market";
import type { CongressFeed, CongressTrade, TickerInfo } from "@/lib/types";
import { getCongressFeed } from "@/lib/universeServer";
import { assetName, congressHref, whenText } from "./CongressRow";
import { InsiderBadge } from "./InsiderBadge";

/**
 * 국회의원 거래 신고 (2026-11-06) — Project_1 data/congress_trades.py (하원 Clerk PTR, 상원은 아직).
 *  · CongressToday  오늘 탭 '국회의원 거래 신고' 표 — 지난 30일 · $15K 이상 · 최근 신고 순 (한 의원은 3줄까지)
 *  · InsiderCongressCard  종목 페이지 — 내부자 90일 + 그 종목 지난 1년 하원 신고 (미국 종목만)
 *  1년 전부 · 의원별은 /quant/congress (CongressExplorer). 거래 한 줄은 CongressRow 를 같이 쓴다.
 * 표시 전용 — 신고는 최대 45일 늦고, 신고 뒤 따라 사면 시장과 비슷했다. 법(5 U.S.C. §13107)상 상업 목적으로 쓰지 않는다.
 */

const HOUSE_SEARCH = "https://disclosures-clerk.house.gov/FinancialDisclosure";

type Row = CongressFeed["recent"][number];

/**
 * 오늘 탭 칸에 올릴 줄 (2026-11-12) — 금액 하한 TODAY_MIN 이상을 1년 전부 보기와 같은 순서(cmpRecent: 신고일 최근 → 금액 큰)로,
 * 한 의원은 TODAY_PER_MEMBER 줄까지 TODAY_N 줄. 예전(큰 금액 순 + 지도부 거래 덧붙임)은 한 달 전 거래가 맨 위에 와서
 * 1년 전부 보기(최근 신고 순)와 순서가 달라 보였다. 지도부 거래는 따로 덧붙이지 않는다 (배지는 그대로).
 */
export function pickToday(feed: CongressFeed): Row[] {
  const per = new Map<string, number>();
  const out: Row[] = [];
  for (const r of feed.recent.filter((x) => (x.low ?? 0) >= TODAY_MIN).sort(cmpRecent)) {
    if (out.length >= TODAY_N) break;
    const n = per.get(r.member) ?? 0;
    if (n >= TODAY_PER_MEMBER) continue;
    per.set(r.member, n + 1);
    out.push(r);
  }
  return out;
}

/**
 * 오늘 탭 카드 (2026-11-10 브리핑 표) — 의원(정당 · 주 · 지도부) · 소유 · 매수/매도 · 종목 · 금액 구간 · 신고일(거래일) · 원문.
 * 폰에서는 표 머리를 숨기고 한 거래를 세 줄 묶음으로 (CSS .cong-table).
 * 머리 오른쪽: 같은 조건(30일 · $15K 이상)으로 1년 전부 보기를 여는 링크 + 1년 전부 보기.
 */
export async function CongressToday({ lang, t }: { lang: Lang; t: Dict }) {
  const feed = await getCongressFeed();
  if (!feed?.recent?.length) return null;
  const C = t.congress;
  const B = t.brief;
  const H = B.congCols;
  const rows = pickToday(feed);
  if (!rows.length) return null;
  // 같은 조건 건수 — Project_1 이 recent 를 400줄에서 잘랐으면(최근 순으로 자름) 정확하지 않으니 숫자는 뺀다
  const whole = (feed.counts?.tx_recent ?? feed.recent.length) <= feed.recent.length;
  const same = whole ? feed.recent.filter((x) => (x.low ?? 0) >= TODAY_MIN).length : null;
  return (
    <section className="card brief-card cong" aria-labelledby="cong-title">
      <div className="brief-head">
        <div className="brief-head__text">
          <h2 id="cong-title">
            {B.congTitle} <span className="brief-en">{B.congEn}</span>
          </h2>
          <p>{C.todaySub(feed.days, amountText(TODAY_MIN), TODAY_PER_MEMBER)}</p>
        </div>
        <div className="brief-head__side">
          <Link className="brief-link" href={sameListHref(feed.days)}>{C.sameList(same)} →</Link>
          <Link className="brief-link" href="/quant/congress">{C.allYear} →</Link>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table cong-table">
          <thead>
            <tr>
              <th scope="col">{H.member}</th>
              <th scope="col">{H.owner}</th>
              <th scope="col">{H.type}</th>
              <th scope="col">{H.ticker}</th>
              <th scope="col" className="r">{H.amount}</th>
              <th scope="col">{H.when}</th>
              <th scope="col" className="r">{H.src}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <TradeTr key={`${r.doc}-${r.ticker}-${r.date}-${r.owner}-${r.amount}-${r.type}`} r={r} lang={lang} t={t} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny muted brief-note">
        {C.note} {feed.scanned.length > 0 && `${C.scanned(feed.scanned.length)}. `}
        <a href={HOUSE_SEARCH} target="_blank" rel="noopener noreferrer">{C.official} ↗</a>
      </p>
    </section>
  );
}

function TradeTr({ r, lang, t }: { r: Row; lang: Lang; t: Dict }) {
  const C = t.congress;
  const party = r.party ? C.party[r.party] ?? r.party : null;
  const kind = r.type === "buy" ? "badge--good" : r.type === "sell" ? "badge--bad" : "badge--mid";
  const label = r.type === "buy" ? C.buy : r.type === "sell" ? (r.partial ? C.sellPartial : C.sell) : C.exchange;
  const w = whenText(r, lang, t);
  return (
    <tr>
      <td className="cong-td-member">
        <Link className="cong-member__name" href={congressHref(r.member)} prefetch={false}>{r.member}</Link>
        {(party || r.state) && (
          <span className={`cong-party cong-party--${(r.party ?? "x").toLowerCase()}`}>{[party, r.state].filter(Boolean).join("·")}</span>
        )}
        {r.leader && (
          <span className="badge badge--held cong-leader" title={r.leader}>
            {C.leader}
          </span>
        )}
      </td>
      <td className="cong-td-owner small muted">{C.owner[r.owner] ?? r.owner}</td>
      <td className="cong-td-type">
        <span className={`badge ${kind}`}>{label}</span>
        {r.atype === "OP" && <span className="chip">{C.option}</span>}
      </td>
      <td className="cong-td-ticker">
        <Link className="tick" href={stockHref(r.ticker)}>{r.ticker}</Link>
        {r.asset && <span className="small muted cong-asset">{shortCompany(assetName(r.asset))}</span>}
      </td>
      <td className="cong-td-amount r num small">{r.amount}</td>
      <td className="cong-td-when small">
        <span className="cong-when__filed">{w.filed}</span>
        {w.trade && <span className="cong-when__trade tiny muted">{w.trade}</span>}
      </td>
      <td className="cong-td-src r small">
        <a href={r.url} target="_blank" rel="noopener noreferrer">{C.source} ↗</a>
      </td>
    </tr>
  );
}

/** 금액 구간 짧게 — 15001 · 50000 → '$15K–$50K', 하한만 있으면 '$50M+'. 둘 다 없으면 null (원문 글자를 쓴다). */
function rangeShort(low: number | null, high: number | null): string | null {
  const k = (v: number) => (v >= 1e6 ? `$${Math.round(v / 1e6)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${v}`);
  if (low == null) return null;
  return high == null ? `${k(low)}+` : `${k(low)}–${k(high)}`;
}

function CongTr({ r, lang, t }: { r: CongressTrade; lang: Lang; t: Dict }) {
  const C = t.congress;
  const party = r.party ? C.party[r.party] ?? r.party : null;
  const kind = r.type === "buy" ? "badge--good" : r.type === "sell" ? "badge--bad" : "badge--mid";
  const label = r.type === "buy" ? C.buy : r.type === "sell" ? (r.partial ? C.sellPartial : C.sell) : C.exchange;
  const who = [party, r.state].filter(Boolean).join("·") + (r.owner !== "self" ? ` · ${C.owner[r.owner] ?? r.owner}` : "");
  return (
    <tr>
      <td className="sd-congtable__who">
        <Link className="cong-member__name" href={congressHref(r.member)} prefetch={false}>{r.member}</Link>{" "}
        <span className="tiny muted">{who}</span>
        {r.leader && <> <span className="badge badge--held cong-leader" title={r.leader}>{C.leader}</span></>}
      </td>
      <td>
        <span className={`badge ${kind}`}>{label}</span>
        {r.atype === "OP" && <span className="chip">{C.option}</span>}
      </td>
      <td className="r num small" title={r.amount}>{rangeShort(r.low, r.high) ?? r.amount}</td>
      <td className="r small">
        <a href={r.url} target="_blank" rel="noopener noreferrer"
          title={
            !r.date || r.lag == null
              ? C.filed(fmtDate(r.filed, lang))
              : badTradeDate(r.date, r.filed)
                ? C.tradedBad(fmtDate(r.date, lang))
                : t.sp.congWhen(fmtDate(r.date, lang), r.lag)
          }>
          {fmtDate(r.filed, lang)}
        </a>
      </td>
    </tr>
  );
}

const INS_N = 5;

/**
 * 종목 페이지 '내부자 · 국회의원 거래' (2026-11-10 개편, 시안) — 위 = 내부자 90일 요약(openinsider · 캐나다는 ceo.ca 링크),
 * 아래 = 그 종목 하원 신고 1년 표 (최근 5줄 + 펼치기). feed = congress.json — 없으면(기능이 켜지기 전 · 캐나다) 국회의원 칸은 빠진다.
 * 표시 전용 — 신고는 최대 45일 늦고, 신고 뒤 따라 사면 시장과 비슷했다.
 */
export function InsiderCongressCard({ ticker, info, trades, feed, cad, lang, t, className = "" }: {
  ticker: string;
  info: TickerInfo;
  trades: CongressTrade[];
  feed: CongressFeed | null;
  cad: boolean;
  lang: Lang;
  t: Dict;
  className?: string;
}) {
  const S = t.sp;
  const C = t.congress;
  const looked = "insider" in info; // 내부자를 조회한 종목 (null = 오늘 조회 안 함)
  const showCong = !!feed && !cad;
  if (!looked && !cad && !showCong) return null;
  const ins = info.insider ?? null;
  const net = ins?.net_value ?? null;
  const badge = !ins
    ? null
    : ins.buys + ins.sells === 0
      ? { text: S.insQuiet, kind: "mid" }
      : net != null && net < 0
        ? { text: S.insNetSell(bigUsd(net)), kind: "bad" }
        : net != null && net > 0
          ? { text: S.insNetBuy(`+${bigUsd(net)}`), kind: "good" }
          : null;
  const rows = [...trades].sort((a, b) => b.filed.localeCompare(a.filed));
  const recent = feed ? rows.filter((r) => Date.parse(r.filed) >= Date.parse(feed.as_of) - 90 * 86_400_000) : [];
  const buys = recent.filter((r) => r.type === "buy").length;
  const sells = recent.filter((r) => r.type === "sell").length;
  const members = new Set(recent.map((r) => r.member)).size;
  const head = (
    <thead>
      <tr>
        <th scope="col">{S.congCols.member}</th>
        <th scope="col">{S.congCols.type}</th>
        <th scope="col" className="r">{S.congCols.amount}</th>
        <th scope="col" className="r">{S.congCols.filed}</th>
      </tr>
    </thead>
  );
  return (
    <section className={`card sd-card ${className}`} aria-labelledby="ins-title">
      <div className="sd-card__head">
        <h2 id="ins-title">{showCong ? S.insTitle : S.insTitleOnly}</h2>
        {badge && <span className={`sd-badge sd-badge--${badge.kind}`}>{badge.text}</span>}
      </div>
      <div className="sd-ins">
        <p className="sd-ins__head">
          <b>{S.insHead}</b>
          <a className="link-strong small" href={cad ? ceoCaUrl(ticker) : openinsiderUrl(ticker)} target="_blank"
            rel="noopener noreferrer" title={cad ? t.insider.caHelp : t.insider.openHelp}>
            {cad ? t.insider.caOpen : S.insOpen}
          </a>
        </p>
        {ins ? (
          <p className="sd-ins__line small">
            <InsiderBadge insider={ins} />
            {net != null && net !== 0 && <span className={`num ${tone(net)}`}>{t.insider.net(`${net > 0 ? "+" : ""}${bigUsd(net)}`)}</span>}
            {ins.last_date && <span className="muted">{S.insLast(fmtDate(ins.last_date, lang))}</span>}
          </p>
        ) : (
          <p className="small muted sd-ins__line">{cad ? t.stock.insiderSubCa : t.stock.insiderNone}</p>
        )}
      </div>
      {showCong && (
        <div className="sd-cong">
          <p className="sd-ins__head">
            <b>{S.congHead}</b>
            {rows.length > 0 && <span className="small muted">{C.summary(buys, sells, members)}</span>}
          </p>
          {rows.length ? (
            <>
              <table className="data-table sd-congtable">
                {head}
                <tbody>
                  {rows.slice(0, INS_N).map((r, i) => <CongTr key={`${r.url}-${i}`} r={r} lang={lang} t={t} />)}
                </tbody>
              </table>
              {rows.length > INS_N && (
                <details className="cong-more sd-more">
                  <summary>{C.more(rows.length - INS_N)}</summary>
                  <table className="data-table sd-congtable">
                    <tbody>
                      {rows.slice(INS_N).map((r, i) => <CongTr key={`${r.url}-m${i}`} r={r} lang={lang} t={t} />)}
                    </tbody>
                  </table>
                </details>
              )}
            </>
          ) : (
            <p className="small muted" style={{ margin: "6px 0 0" }}>{C.none}</p>
          )}
          <p className="tiny muted sd-note">
            {C.note}{" "}
            <Link className="link-strong" href={congressHref(ticker)}>{C.byMember} →</Link>
          </p>
        </div>
      )}
    </section>
  );
}
