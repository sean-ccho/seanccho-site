"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { congressHref, MemberLabel, TradeRow, type TradeView } from "./CongressRow";
import { useT } from "./LangProvider";
import { SearchIcon } from "./StockControls";
import { daysAgo, median, pdfUrl, type CxMember, type CxRow } from "@/lib/congress";
import { fmtDate, stockHref } from "@/lib/format";

/**
 * 국회의원 거래 화면 (2026-11-06) — 1년 거래 전부(약 4천 줄)를 브라우저에서 거른다.
 * 거래 목록: 의원 이름 · 티커 찾기, 매수 · 매도, 금액 하한, 기간(30일 · 90일 · 1년), 정당, 지도부만 → 신고일 최근 순 50줄씩.
 * 의원별: 같은 조건으로 의원마다 거래 수 · 매수 · 매도 · $50,001 이상 · 자주 거래한 종목 · 신고까지 중앙값 · 마지막 신고.
 * 회사 이름은 종목 찾기 목록(/api/tickers)에서 붙인다 (못 받으면 티커만).
 */

type Side = "all" | "buy" | "sell";
type Party = "all" | "D" | "R";
type View = "trades" | "members";
type MemberSort = "trades" | "big" | "recent";

const AMOUNTS = [0, 15_001, 50_001, 250_001, 1_000_001] as const;
const PERIODS = [30, 90, 365] as const;
const PAGE = 50;
const BIG = 50_001;

function amountText(v: number): string {
  return v >= 1_000_000 ? `$${(v - 1) / 1_000_000}M` : `$${Math.round((v - 1) / 1000)}K`;
}

export function CongressExplorer({ members, rows, asOf, initialQ, initialView }: {
  members: CxMember[];
  rows: CxRow[];
  asOf: string;
  initialQ: string;
  initialView: View;
}) {
  const { lang, t } = useT();
  const C = t.congress;
  const [view, setView] = useState<View>(initialView);
  const [q, setQ] = useState(initialQ);
  const [side, setSide] = useState<Side>("all");
  const [minAmt, setMinAmt] = useState<number>(0);
  const [days, setDays] = useState<number>(365);
  const [party, setParty] = useState<Party>("all");
  const [leaderOnly, setLeaderOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [sort, setSort] = useState<MemberSort>("trades");
  const [names, setNames] = useState<Map<string, string>>(new Map());

  // 회사 이름 — 종목 찾기와 같은 목록 (CDN 캐시)
  useEffect(() => {
    let alive = true;
    fetch("/api/tickers")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: [string, string, string][]) => {
        if (alive) setNames(new Map(list.map(([tk, name]) => [tk, name])));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 주소의 ?q= 가 바뀌면 (의원 이름 링크) 그 값으로
  useEffect(() => {
    setQ(initialQ);
    setLimit(PAGE);
  }, [initialQ]);

  const from = daysAgo(asOf, days);
  const needle = q.trim().toLowerCase();
  const tickerNeedle = q.trim().toUpperCase().replace(".", "-");

  // 의원 · 티커 찾기를 뺀 조건 (의원별 보기는 찾기를 의원 이름에만 쓴다)
  const base = useMemo(
    () =>
      rows.filter((r) => {
        if (r.f < from) return false;
        if (side !== "all" && r.y !== side) return false;
        if (minAmt && (r.lo ?? 0) < minAmt) return false;
        const m = members[r.m];
        if (party !== "all" && m.party !== party) return false;
        if (leaderOnly && !m.leader) return false;
        return true;
      }),
    [rows, members, from, side, minAmt, party, leaderOnly],
  );

  const matchMember = (m: CxMember) => !needle || m.name.toLowerCase().includes(needle);
  const filtered = useMemo(
    () => base.filter((r) => !needle || r.t === tickerNeedle || r.t.startsWith(tickerNeedle) || matchMember(members[r.m])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, needle, tickerNeedle, members],
  );

  const stats = useMemo(() => {
    const lags = filtered.map((r) => r.l).filter((x): x is number => x != null);
    return {
      n: filtered.length,
      b: filtered.filter((r) => r.y === "buy").length,
      s: filtered.filter((r) => r.y === "sell").length,
      m: new Set(filtered.map((r) => r.m)).size,
      lag: median(lags),
    };
  }, [filtered]);

  const memberRows = useMemo(() => {
    const by = new Map<number, CxRow[]>();
    for (const r of filtered) {
      const list = by.get(r.m);
      if (list) list.push(r);
      else by.set(r.m, [r]);
    }
    const out = [...by.entries()].map(([mi, list]) => {
      const counts = new Map<string, number>();
      for (const r of list) counts.set(r.t, (counts.get(r.t) ?? 0) + 1);
      return {
        m: members[mi],
        n: list.length,
        b: list.filter((r) => r.y === "buy").length,
        s: list.filter((r) => r.y === "sell").length,
        big: list.filter((r) => (r.lo ?? 0) >= BIG).length,
        top: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
        lag: median(list.map((r) => r.l).filter((x): x is number => x != null)),
        last: list.reduce((a, r) => (r.f > a ? r.f : a), ""),
      };
    });
    out.sort((a, b) =>
      sort === "big" ? b.big - a.big || b.n - a.n : sort === "recent" ? b.last.localeCompare(a.last) : b.n - a.n,
    );
    return out;
  }, [filtered, members, sort]);

  const view_ = (r: CxRow): TradeView => {
    const m = members[r.m];
    return {
      member: m.name, party: m.party, state: m.state, leader: m.leader, owner: r.o, type: r.y, partial: r.p, atype: r.a,
      amount: r.amt, date: r.d, lag: r.l, filed: r.f, url: pdfUrl(r.u), ticker: r.t,
    };
  };

  const reset = () => {
    setQ("");
    setSide("all");
    setMinAmt(0);
    setDays(365);
    setParty("all");
    setLeaderOnly(false);
    setLimit(PAGE);
  };

  const seg = <T extends string | number>(label: string, value: T, set: (v: T) => void, options: { v: T; label: string }[]) => (
    <div className="cx-seg">
      <span className="cx-seg__label">{label}</span>
      <div className="tseg tseg--wrap" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.v)} type="button" aria-pressed={value === o.v}
            onClick={() => {
              set(o.v);
              setLimit(PAGE);
            }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="cx">
      <div className="cx-controls card">
        <div className="cx-top">
          <div className="tseg" role="group" aria-label={C.viewAria}>
            <button type="button" aria-pressed={view === "trades"} onClick={() => setView("trades")}>{C.viewTrades}</button>
            <button type="button" aria-pressed={view === "members"} onClick={() => setView("members")}>{C.viewMembers}</button>
          </div>
          <div className="ctl-search cx-search">
            <label htmlFor="cx-search" className="sr-only">{C.searchLabel}</label>
            <SearchIcon />
            <input id="cx-search" className="input" type="search" value={q} placeholder={C.searchPh} autoComplete="off"
              spellCheck={false} onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }} />
          </div>
          <button type="button" className="cx-reset" onClick={reset}>{C.reset}</button>
        </div>
        <div className="cx-filters">
          {seg<Side>(C.side, side, setSide, [
            { v: "all", label: C.sideAll }, { v: "buy", label: C.buy }, { v: "sell", label: C.sell },
          ])}
          {seg<number>(C.amountLabel, minAmt, setMinAmt, AMOUNTS.map((v) => ({ v, label: v ? C.amountMin(amountText(v)) : C.amountAll })))}
          {seg<number>(C.period, days, setDays, PERIODS.map((v) => ({ v, label: C.days(v) })))}
          {seg<Party>(C.partyLabel, party, setParty, [
            { v: "all", label: C.partyAll }, { v: "D", label: C.party.D }, { v: "R", label: C.party.R },
          ])}
          <label className="cx-check">
            <input id="cx-leader" type="checkbox" checked={leaderOnly} onChange={(e) => {
              setLeaderOnly(e.target.checked);
              setLimit(PAGE);
            }} />
            {C.leaderOnly}
          </label>
        </div>
      </div>

      <p className="small cx-stats" aria-live="polite">{C.stats(stats.n, stats.b, stats.s, stats.m, stats.lag)}</p>

      {view === "trades" ? (
        filtered.length ? (
          <div className="card cong__card">
            <ol className="cong-list">
              {filtered.slice(0, limit).map((r, i) => (
                <TradeRow key={`${r.u}-${r.t}-${r.d}-${r.o}-${r.amt}-${i}`} r={view_(r)} lang={lang} t={t} showTicker
                  name={names.get(r.t) ?? null} />
              ))}
            </ol>
            {filtered.length > limit && (
              <button type="button" className="cx-more" onClick={() => setLimit((n) => n + PAGE * 2)}>
                {C.showMore(Math.min(PAGE * 2, filtered.length - limit))}
              </button>
            )}
          </div>
        ) : (
          <p className="muted">{C.none2}</p>
        )
      ) : memberRows.length ? (
        <>
          <div className="cx-seg">
            <span className="cx-seg__label">{C.memberSort}</span>
            <div className="tseg" role="group" aria-label={C.memberSort}>
              {(["trades", "big", "recent"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>
                  {k === "trades" ? C.sortTrades : k === "big" ? C.sortBig : C.sortRecent}
                </button>
              ))}
            </div>
          </div>
          <div className="card cong__card">
            <ol className="cong-list">
              {memberRows.map((x) => (
                <li key={`${x.m.name}-${x.m.state}`} className="cong-row cx-member">
                  <span className="cong-row__main">
                    <MemberLabel r={{ member: x.m.name, party: x.m.party, state: x.m.state, leader: x.m.leader }} t={t} />
                    <span className="small">{C.memberTrades(x.n, x.b, x.s)}</span>
                    {x.big > 0 && <span className="chip">{C.memberBig(x.big)}</span>}
                    <span className="cx-top-tickers">
                      <span className="tiny muted">{C.memberTop}</span>
                      {x.top.map(([tk, n]) => (
                        <Link key={tk} className="tick" href={stockHref(tk)} title={names.get(tk) ?? tk}>
                          {tk}<span className="tiny muted"> {n}</span>
                        </Link>
                      ))}
                    </span>
                  </span>
                  <span className="tiny muted cong-row__when">
                    {[C.memberLag(x.lag), C.memberLast(fmtDate(x.last, lang))].filter(Boolean).join(" · ")}
                    {" · "}
                    <Link href={congressHref(x.m.name)} prefetch={false} onClick={() => setView("trades")}>{C.seeTrades} →</Link>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : (
        <p className="muted">{C.none2}</p>
      )}
    </div>
  );
}
