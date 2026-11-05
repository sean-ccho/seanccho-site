import type { Metadata } from "next";
import Link from "next/link";
import { AdminTabs, LockIcon } from "@/components/AdminTabs";
import { ago, HM, makeClock, when, type Clock } from "@/lib/adminTime";
import { DICTS } from "@/lib/i18n";
import { DIRECT, LOG_MAX, readVisitors, sourceOf, type DayStat, type VisitEvent } from "@/lib/visits";

/**
 * 관리 · 방문자 (2026-11-05) — 누가(어디서 · 어떤 기기로 · 어디를 거쳐) 언제 들어와 무엇을 봤는지 + 트래픽.
 * 기록 = components/VisitTracker.tsx → /api/visit → Upstash Redis (lib/visits.ts). IP 는 저장하지 않는다.
 * 비밀번호(proxy.ts) · 본인만 보는 화면이라 한국어만 · 시간은 토론토.
 */

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "관리 · 방문자", robots: { index: false, follow: false } };

const NAV = DICTS.ko.nav;
const REGION = new Intl.DisplayNames(["ko"], { type: "region" });
const LANGNAME = new Intl.DisplayNames(["ko"], { type: "language" });
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const LIVE_MS = 5 * 60_000;

const PAGES: Record<string, string> = {
  "/": "홈",
  "/quant": NAV.today,
  "/quant/candidates": NAV.candidates,
  "/quant/charts": NAV.charts,
  "/quant/charts/all": NAV.allCharts,
  "/quant/universe": NAV.universe,
  "/quant/etf": NAV.etf,
  "/quant/sectors": NAV.sectors,
  "/quant/account": NAV.acctTabs.account,
  "/quant/watchlist": NAV.acctTabs.watchlist,
  "/quant/pt1": NAV.acctTabs.pt1,
  "/quant/trades": NAV.acctTabs.trades,
  "/quant/journal": "매매일지",
  "/quant/admin": "관리",
  "/quant/admin/visitors": "관리 · 방문자",
};

/** 경로 → 메뉴 이름 ('/quant/stock/NVDA' → 'NVDA'). */
function pageLabel(p: string): string {
  if (PAGES[p]) return PAGES[p];
  const m = p.match(/^\/quant\/stock\/([^/]+)$/);
  if (m) {
    try {
      return decodeURIComponent(m[1]).toUpperCase();
    } catch {
      return m[1].toUpperCase();
    }
  }
  return p;
}

function country(cc: string): string {
  if (!cc || cc === "?") return "위치 모름";
  try {
    return REGION.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/** 'Toronto, ON · 캐나다' — 도시가 없으면 나라만. */
function place(e: Pick<VisitEvent, "cc" | "rg" | "ci">): string {
  const c = country(e.cc);
  if (!e.ci) return c;
  return `${e.ci}${e.rg && !/^\d+$/.test(e.rg) ? `, ${e.rg}` : ""} · ${c}`;
}

function langName(l: string): string {
  if (!l) return "";
  try {
    return LANGNAME.of(l.split("-")[0]) ?? l;
  } catch {
    return l;
  }
}

const fmt = (n: number) => n.toLocaleString("en-US");

function dur(m: number): string {
  const min = Math.round(m / 60_000);
  if (min < 1) return "1분 미만";
  return min < 60 ? `${min}분` : `${Math.floor(min / 60)}시간 ${min % 60}분`;
}

/** 축 눈금용 — 1 · 2 · 5 × 10^k 로 올림. */
function niceCeil(v: number): number {
  if (v <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

type Session = {
  id: string;
  v: string;
  /** 시간 순 (처음 본 페이지 → 마지막) */
  pages: VisitEvent[];
  first: VisitEvent;
  last: VisitEvent;
  /** 이 목록 안에서 이 사람의 몇 번째 방문 */
  nth: number;
};

/** 최신 → 과거 순 이벤트를 방문(세션) 단위로. 마지막 활동이 최근인 방문이 먼저. */
function toSessions(events: VisitEvent[]): Session[] {
  const map = new Map<string, Session>();
  const order: Session[] = [];
  for (const e of events) {
    let s = map.get(e.s);
    if (!s) {
      s = { id: e.s, v: e.v, pages: [], first: e, last: e, nth: 1 };
      map.set(e.s, s);
      order.push(s);
    }
    s.pages.push(e);
    s.first = e; // 과거로 갈수록 덮어써서 마지막엔 그 방문의 첫 페이지
  }
  for (const s of order) s.pages.reverse();
  // 같은 사람의 방문 번호 (오래된 것부터 1, 2, 3 …)
  const byVisitor = new Map<string, Session[]>();
  for (const s of order) byVisitor.set(s.v, [...(byVisitor.get(s.v) ?? []), s]);
  for (const list of byVisitor.values()) {
    list.sort((a, b) => a.first.t - b.first.t).forEach((s, i) => (s.nth = i + 1));
  }
  return order;
}

/** 여러 날 집계 해시에서 'p:' 같은 앞글자 칸만 더해 많은 순으로. */
function topFields(days: DayStat[], prefix: string, limit: number): { key: string; n: number }[] {
  const sum = new Map<string, number>();
  for (const d of days) {
    for (const [k, v] of Object.entries(d.fields)) {
      if (k.startsWith(prefix)) sum.set(k.slice(prefix.length), (sum.get(k.slice(prefix.length)) ?? 0) + v);
    }
  }
  return [...sum].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n).slice(0, limit);
}

const total = (days: DayStat[], k: "pv" | "sessions" | "newVisitors") => days.reduce((a, d) => a + d[k], 0);

export default async function VisitorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const range = sp.range === "30" ? 30 : 7;
  const shown = sp.n === "all" ? Infinity : 50;
  const now = Date.now();
  const clock = makeClock(now);
  const data = await readVisitors(now);

  const head = (
    <>
      <AdminTabs current="visitors" />
      <div className="page-title adm-title">
        <div>
          <h1>관리 · 방문자</h1>
          <p>누가 언제 어디서 들어와 무엇을 봤는지 · 시간은 모두 토론토(ET) · 열 때마다 새로 읽어요 ({HM.format(now)})</p>
        </div>
        <span className="adm-lock"><LockIcon />관리자만 · 내계좌 비밀번호</span>
      </div>
    </>
  );

  if (data.mode === "none") {
    return (
      <main className="container container--wide page adm">
        {head}
        <section className="card adm-card adm-v-setup">
          <h2>방문 기록 저장소가 아직 연결 안 됐어요</h2>
          <p className="adm-lead">무료 Redis 하나만 연결하면 그때부터 방문이 쌓여요. 코드는 이미 들어가 있어요.</p>
          <ol>
            <li>Vercel → personal-site 프로젝트 → <b>Storage</b> → <b>Create Database</b> → <b>Upstash for Redis</b> (Free) → 이 프로젝트에 <b>Connect</b></li>
            <li>프로젝트 → <b>Analytics</b> → <b>Enable</b> (Vercel 쪽 통계 · 같이 보면 좋아요)</li>
            <li><b>Deployments</b> → 맨 위 배포 → <b>Redeploy</b> — 그 뒤부터 이 화면에 쌓여요</li>
          </ol>
        </section>
      </main>
    );
  }

  const days = data.days;
  const today = days[days.length - 1];
  const yesterday = days[days.length - 2];
  const last7 = days.slice(-7);
  const inRange = days.slice(-range);
  const sessions = toSessions(data.events);
  const liveVisitors = new Set(data.events.filter((e) => now - e.t < LIVE_MS).map((e) => e.v));
  const live30 = new Set(data.events.filter((e) => now - e.t < 30 * 60_000).map((e) => e.v));
  const livePages = data.events
    .filter((e) => now - e.t < LIVE_MS)
    .reduce((m, e) => (m.has(e.v) ? m : m.set(e.v, e)), new Map<string, VisitEvent>());

  // ── 30일 막대 ──
  const maxV = Math.max(0, ...days.map((d) => d.visitors));
  const top = niceCeil(maxV);
  const maxIdx = days.findIndex((d) => d.visitors === maxV);

  type Row = { label: string; n: number };
  const rowsOf = (prefix: string, limit: number): Row[] => topFields(inRange, prefix, limit).map((r) => ({ label: r.key, n: r.n }));
  const sessionsIn = total(inRange, "sessions");
  const lists: { title: string; unit: string; total: number; parts: { sub?: string; rows: Row[] }[] }[] = [
    {
      title: "많이 본 페이지",
      unit: "페이지뷰",
      total: total(inRange, "pv"),
      parts: [{ rows: topFields(inRange, "p:", 10).map((r) => ({ label: pageLabel(r.key), n: r.n })) }],
    },
    { title: "어디서 왔나", unit: "방문", total: sessionsIn, parts: [{ rows: rowsOf("r:", 8) }] },
    {
      title: "어디서 봤나",
      unit: "방문",
      total: sessionsIn,
      parts: [
        {
          rows: topFields(inRange, "ct:", 8).map((r) => {
            const [cc, ci] = r.key.split("|");
            return { label: place({ cc, rg: "", ci }), n: r.n };
          }),
        },
      ],
    },
    {
      title: "기기 · 브라우저",
      unit: "방문",
      total: sessionsIn,
      parts: [
        { sub: "기기", rows: rowsOf("d:", 5) },
        { sub: "브라우저 · 앱", rows: rowsOf("b:", 5) },
      ],
    },
  ];

  return (
    <main className="container container--wide page adm">
      {head}

      <div className="adm-tiles">
        <div className="card adm-tile">
          <div className="adm-tile__k">지금 보는 중 (5분)</div>
          <div className="adm-tile__v">{fmt(liveVisitors.size)}명</div>
          <div className="adm-tile__s">
            {livePages.size > 0
              ? [...livePages.values()].slice(0, 3).map((e) => `${pageLabel(e.p)} (${e.ci || country(e.cc)})`).join(" · ")
              : `최근 30분 ${fmt(live30.size)}명`}
          </div>
        </div>
        <div className="card adm-tile">
          <div className="adm-tile__k">오늘</div>
          <div className="adm-tile__v">방문자 {fmt(today?.visitors ?? 0)}명</div>
          <div className="adm-tile__s">
            방문 {fmt(today?.sessions ?? 0)}번 · 페이지 {fmt(today?.pv ?? 0)} · 처음 온 사람 {fmt(today?.newVisitors ?? 0)}명
            <br />어제 방문자 {fmt(yesterday?.visitors ?? 0)}명 · 페이지 {fmt(yesterday?.pv ?? 0)}
          </div>
        </div>
        <div className="card adm-tile">
          <div className="adm-tile__k">최근 7일</div>
          <div className="adm-tile__v">방문자 {fmt(data.visitors7)}명</div>
          <div className="adm-tile__s">
            방문 {fmt(total(last7, "sessions"))}번 · 페이지 {fmt(total(last7, "pv"))} · 처음 온 사람 {fmt(total(last7, "newVisitors"))}명
          </div>
        </div>
        <div className={`card adm-tile${data.error ? " adm-tile--bad" : ""}`}>
          <div className="adm-tile__k">{data.error ? "저장소 오류" : "최근 30일"}</div>
          <div className="adm-tile__v">{data.error ? "못 읽었어요" : `방문자 ${fmt(data.visitors30)}명`}</div>
          <div className="adm-tile__s">
            {data.error
              ? data.error
              : `방문 ${fmt(total(days, "sessions"))}번 · 페이지 ${fmt(total(days, "pv"))}${data.mode === "memory" ? " · 로컬 메모리 저장(확인용)" : ""}`}
          </div>
        </div>
      </div>

      <div className="adm-sec">
        <h2>하루 방문자</h2>
        <span>최근 30일 · 막대에 올리면 그날 방문 · 페이지 수</span>
      </div>
      <section className="card adm-v-chart">
        <div className="vbars">
          <div className="vbars__y num" aria-hidden="true">
            <span style={{ bottom: "100%" }}>{fmt(top)}</span>
            <span style={{ bottom: "50%" }}>{top >= 2 ? fmt(top / 2) : ""}</span>
            <span style={{ bottom: "0%" }}>0</span>
          </div>
          <div className="vbars__plot">
            <div className="vbars__grid" style={{ bottom: "100%" }} />
            <div className="vbars__grid" style={{ bottom: "50%" }} />
            <ol className="vbars__cols" aria-label="최근 30일 하루 방문자 수">
              {days.map((d, i) => {
                const wd = WEEKDAY[new Date(`${d.date}T12:00:00Z`).getUTCDay()];
                const tip = `${d.date.slice(5)} (${wd}) · 방문자 ${fmt(d.visitors)}명 · 방문 ${fmt(d.sessions)}번 · 페이지 ${fmt(d.pv)}`;
                const showVal = d.visitors > 0 && (i === days.length - 1 || i === maxIdx);
                const edge = i < 4 ? "l" : i > days.length - 5 ? "r" : undefined;
                return (
                  <li key={d.date} className="vbars__col" tabIndex={0} aria-label={tip} data-edge={edge}>
                    <div className="vbars__bar" style={{ height: `${(d.visitors / top) * 100}%` }}>
                      {showVal && <span className="vbars__val num">{fmt(d.visitors)}</span>}
                    </div>
                    <span className="vbars__tip" aria-hidden="true">{tip}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          <div />
          <div className="vbars__x num" aria-hidden="true">
            {days.map((d, i) => (
              <span key={d.date}>{i % 7 === 1 || i === days.length - 1 ? (i === days.length - 1 ? "오늘" : d.date.slice(5)) : ""}</span>
            ))}
          </div>
        </div>
        <details className="adm-v-table">
          <summary>표로 보기</summary>
          <div className="table-wrap">
            <table className="data-table adm-tbl adm-tbl--narrow">
              <thead>
                <tr><th scope="col">날짜</th><th scope="col" className="r">방문자</th><th scope="col" className="r">방문</th><th scope="col" className="r">페이지</th><th scope="col" className="r">처음 온 사람</th></tr>
              </thead>
              <tbody>
                {[...days].reverse().map((d) => (
                  <tr key={d.date}>
                    <td className="num">{d.date.slice(5)} ({WEEKDAY[new Date(`${d.date}T12:00:00Z`).getUTCDay()]})</td>
                    <td className="num r">{fmt(d.visitors)}</td>
                    <td className="num r">{fmt(d.sessions)}</td>
                    <td className="num r">{fmt(d.pv)}</td>
                    <td className="num r">{fmt(d.newVisitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="adm-sec adm-sec--tools">
        <h2>많이 본 곳 · 들어온 길</h2>
        <nav className="adm-range" aria-label="기간">
          {[7, 30].map((r) => (
            <Link key={r} href={r === 7 ? "/quant/admin/visitors" : "/quant/admin/visitors?range=30"} prefetch={false}
              aria-current={range === r ? "true" : undefined} scroll={false}>
              {r}일
            </Link>
          ))}
        </nav>
      </div>
      <div className="adm-v-lists">
        {lists.map((l) => (
          <section key={l.title} className="card adm-v-list">
            <h3>{l.title} <span>{l.unit}</span></h3>
            {l.parts.every((part) => part.rows.length === 0) ? (
              <p className="muted adm-v-empty">아직 없어요</p>
            ) : (
              l.parts.map((part) => (
                <div key={part.sub ?? l.title} className="adm-v-part">
                  {part.sub && <h4>{part.sub}</h4>}
                  <ol>
                    {part.rows.map((r) => (
                      <li key={r.label}>
                        <div className="adm-v-row">
                          <span className="adm-v-label">{r.label}</span>
                          <span className="num">{fmt(r.n)}<small> · {l.total ? Math.round((r.n / l.total) * 100) : 0}%</small></span>
                        </div>
                        <div className="adm-v-share" aria-hidden="true">
                          <i style={{ width: `${l.total ? Math.max(2, (r.n / l.total) * 100) : 0}%` }} />
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))
            )}
          </section>
        ))}
      </div>

      <div className="adm-sec">
        <h2>최근 방문</h2>
        <span>한 줄 = 한 번 방문 (30분 넘게 쉬면 새 방문) · 최근 활동 순 · #번호가 같으면 같은 브라우저</span>
      </div>
      <section className="card adm-v-visits">
        {sessions.length === 0 ? (
          <p className="muted adm-v-empty">아직 방문 기록이 없어요. 다른 기기나 시크릿 창으로 사이트를 열어 보면 여기 떠요.</p>
        ) : (
          <ol>
            {sessions.slice(0, shown).map((s) => (
              <VisitRow key={s.id} s={s} clock={clock} live={now - s.last.t < LIVE_MS} />
            ))}
          </ol>
        )}
        {sessions.length > shown && (
          <p className="adm-v-more">
            <Link href={`/quant/admin/visitors?n=all${range === 30 ? "&range=30" : ""}`} prefetch={false}>
              {fmt(sessions.length - shown)}개 더 보기 →
            </Link>
          </p>
        )}
      </section>

      <p className="adm-note adm-note--plain adm-v-foot">
        IP 는 저장하지 않아요 — 위치는 Vercel 이 알려 주는 나라 · 주 · 도시(통신사 위치라 다른 도시로 나올 수 있어요), 같은 사람은
        브라우저 안 무작위 번호로만 알아봐요 (브라우저를 바꾸거나 방문 기록을 지우면 새 사람). 검색 로봇 · 미리보기 로봇은 빠져요.
        <br />
        이 화면이나 내계좌를 연 브라우저는 주인으로 표시돼 집계에서 빠져요 — 폰에서도 한 번 열어 두면 폰도 빠져요.
        <br />
        보관: 방문 목록 최근 {fmt(LOG_MAX)}페이지 · 하루 집계 400일. Vercel → 프로젝트 → Analytics 에서도 숫자를 볼 수 있어요
        (로봇 거르는 방식이 달라 조금 다를 수 있어요).
      </p>
    </main>
  );
}

function VisitRow({ s, clock, live }: { s: Session; clock: Clock; live: boolean }) {
  const f = s.first;
  const span = s.last.t - f.t;
  const pages = s.pages.map((e) => pageLabel(e.p));
  const shownPages = pages.length > 8 ? [...pages.slice(0, 7), `… ${pages.length - 8}개 …`, pages[pages.length - 1]] : pages;
  const lang = langName(f.l);
  const src = sourceOf(f);
  const again =
    f.n === 1
      ? null
      : f.g == null
        ? "다시 온 사람"
        : f.g === 0
          ? "오늘 또 옴"
          : `다시 옴 · 지난 방문 ${f.g}일 전`;
  return (
    <li className="adm-v-visit">
      <div className="adm-v-when">
        <b>{when(f.t, clock)}</b>
        <span>{pages.length > 1 ? `${dur(span)} · ${pages.length}쪽` : "1쪽"}</span>
        {live && <span className="badge badge--good">지금</span>}
      </div>
      <div className="adm-v-who">
        <div className="adm-v-line">
          <b>{place(f)}</b>
          <span>{f.d} · {f.b}</span>
          {lang && <span>{lang}</span>}
          <span>{src === DIRECT ? "직접 들어옴 (주소 · 즐겨찾기)" : `${src}에서`}</span>
        </div>
        <div className="adm-v-line adm-v-line--sub">
          <span className="adm-v-id num" title="같은 브라우저 표시 (무작위 번호 앞 4자리)">#{s.v.slice(0, 4)}</span>
          {again ? <span>{again}</span> : <span className="badge badge--mid">처음 온 사람</span>}
          {s.nth > 1 && <span>이 목록에서 {s.nth}번째 방문</span>}
          {pages.length === 1 && <span className="muted">{ago(f.t, clock.now)}</span>}
        </div>
        <div className="adm-v-path">
          {shownPages.map((p, i) => (
            <span key={`${i}-${p}`}>{p}</span>
          ))}
        </div>
      </div>
    </li>
  );
}

