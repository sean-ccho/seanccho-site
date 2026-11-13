import Link from "next/link";
import { fmtDate, stockHref } from "@/lib/format";
import { badTradeDate } from "@/lib/congress";
import type { Dict, Lang } from "@/lib/i18n";
import { shortCompany } from "@/lib/market";

/**
 * 국회의원 거래 한 줄 (2026-11-06) — 오늘 탭 '최근 신고' · 종목 카드(서버)와 국회의원 거래 화면(브라우저)이 같이 쓴다.
 * 의원 이름을 누르면 그 의원의 1년 거래 (/quant/congress?q=이름).
 */
export type TradeView = {
  member: string;
  party: string | null;
  state: string | null;
  leader: string | null;
  owner: string;
  type: "buy" | "sell" | "exchange";
  partial: boolean;
  atype: string;
  amount: string;
  date: string | null;
  lag: number | null;
  filed: string;
  url: string;
  ticker?: string;
  asset?: string | null;
};

export function congressHref(q: string): string {
  return `/quant/congress?q=${encodeURIComponent(q)}`;
}

/** 'Alphabet Inc. - Class C Capital Stock' → 'Alphabet Inc.' · 'Datadog, Inc. - Class A Common Stock' → 'Datadog' */
export function assetName(asset: string): string {
  return shortCompany(asset.split(" - ")[0].replace(/\s+(Class [A-C]\s+)?(Common|Capital|Ordinary)\s+(Stock|Shares).*$/i, ""));
}

/**
 * 날짜 칸 (2026-11-12) — 두 화면 다 신고일 순이라 신고일을 먼저, 그다음 거래일 · 신고까지 며칠.
 * 거래일이 신고일보다 늦으면(원문 신고서 날짜 오류) 며칠은 쓰지 않고 그렇다고만.
 */
export function whenText(r: Pick<TradeView, "date" | "lag" | "filed">, lang: Lang, t: Dict): { filed: string; trade: string | null } {
  const C = t.congress;
  const filed = C.filed(fmtDate(r.filed, lang));
  if (!r.date) return { filed, trade: null };
  const d = fmtDate(r.date, lang);
  return { filed, trade: badTradeDate(r.date, r.filed) ? C.tradedBad(d) : C.traded(d, r.lag) };
}

function typeLabel(r: TradeView, t: Dict): string {
  const C = t.congress;
  return r.type === "buy" ? C.buy : r.type === "sell" ? (r.partial ? C.sellPartial : C.sell) : C.exchange;
}

/** 의원 이름(링크) · 정당-주 · 지도부 · 소유자 */
export function MemberLabel({ r, t, link = true }: { r: Pick<TradeView, "member" | "party" | "state" | "leader"> & { owner?: string }; t: Dict; link?: boolean }) {
  const C = t.congress;
  const party = r.party ? C.party[r.party] ?? r.party : null;
  return (
    <span className="cong-member">
      {link ? <Link className="cong-member__name" href={congressHref(r.member)} prefetch={false}>{r.member}</Link> : <b>{r.member}</b>}
      {(party || r.state) && <span className="tiny muted">{[party, r.state].filter(Boolean).join("·")}</span>}
      {r.leader && (
        <span className="badge badge--held cong-leader" title={r.leader}>
          {C.leader}
        </span>
      )}
      {r.owner && r.owner !== "self" && <span className="chip cong-owner">{C.owner[r.owner] ?? r.owner}</span>}
    </span>
  );
}

export function TradeRow({ r, lang, t, showTicker, name }: { r: TradeView; lang: Lang; t: Dict; showTicker: boolean; name?: string | null }) {
  const C = t.congress;
  const up = r.type === "buy";
  const company = name ?? (r.asset ? assetName(r.asset) : null);
  const w = whenText(r, lang, t);
  return (
    <li className="cong-row">
      <span className="cong-row__main">
        <MemberLabel r={r} t={t} />
        <span className="cong-row__what">
          <span className={`badge ${up ? "badge--good" : r.type === "sell" ? "badge--bad" : ""}`}>{typeLabel(r, t)}</span>
          {showTicker && r.ticker && (
            <>
              <Link className="tick" href={stockHref(r.ticker)}>{r.ticker}</Link>
              {company && <span className="tiny muted cong-asset">{shortCompany(company)}</span>}
            </>
          )}
          {r.atype === "OP" && <span className="chip">{C.option}</span>}
          <span className="num small">{r.amount}</span>
        </span>
      </span>
      <span className="tiny muted cong-row__when">
        <span className="cong-when__filed">{w.filed}</span>
        {w.trade && ` · ${w.trade}`}
        {" · "}
        <a href={r.url} target="_blank" rel="noopener noreferrer">{C.source} ↗</a>
      </span>
    </li>
  );
}
