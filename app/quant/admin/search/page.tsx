import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminTabs, LockIcon } from "@/components/AdminTabs";
import { HM } from "@/lib/adminTime";
import { GSC_SITE, inspectUrls, opportunities, readSearch, type GscRow, type Inspection, type OppKind, type SitemapInfo } from "@/lib/gsc";
import { QUANT_INDEXABLE } from "@/lib/siteUrl";
import { requireAdmin } from "@/lib/viewer";

/**
 * 관리 · 검색 (2026-11-25) — 구글 검색에서 이 사이트가 어떤 검색어로 보이고(노출) 눌렸는지(클릭), 몇 위인지, 페이지가 구글에
 * 올라갔는지(색인). 사용자가 본 영상의 방법 그대로: 노출은 많은데 클릭이 적은 검색어를 골라 그 검색어에 맞게 페이지를 고친다
 * ('기회' 세 갈래 — lib/gsc.ts opportunities). 숫자는 Google Search Console API (서비스 계정 · 읽기 전용).
 * 관리자 로그인 · 본인만 보는 화면이라 한국어만.
 */

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "관리 · 검색", robots: { index: false, follow: false } };

const RANGES = [7, 28, 90] as const;
const SITE = GSC_SITE.replace(/\/$/, "");
/** 색인 상태를 물어볼 주소 — 메뉴 화면 + 종목 페이지 몇 개 (URL 검사는 하루 2,000번까지라 화면을 열 때 이만큼만). */
const INSPECT = [
  "/quant",
  "/quant/universe",
  "/quant/sectors",
  "/quant/etf",
  "/quant/congress",
  "/quant/model",
  "/quant/candidates",
  "/quant/charts",
  "/quant/stock/PLTR",
  "/quant/stock/NVDA",
  "/quant/stock/GOOGL",
  "/quant/stock/RY.TO",
];

const PAGES: Record<string, string> = {
  "/": "홈",
  "/quant": "오늘 (첫 화면)",
  "/quant/candidates": "매수 후보",
  "/quant/charts": "차트",
  "/quant/charts/all": "차트 전체",
  "/quant/universe": "전체분석",
  "/quant/etf": "ETF",
  "/quant/sectors": "섹터 지도",
  "/quant/congress": "국회의원 거래",
  "/quant/model": "예측 모델",
};

/** 'https://seancho.vercel.app/quant/stock/PLTR' → 'PLTR 종목' · '/quant/universe' → '전체분석'. */
function pageName(url: string): string {
  const p = url.startsWith(SITE) ? url.slice(SITE.length) || "/" : url;
  const path = p.split(/[?#]/)[0];
  if (PAGES[path]) return PAGES[path];
  const m = path.match(/^\/quant\/stock\/([^/]+)$/);
  if (m) {
    try {
      return `${decodeURIComponent(m[1]).toUpperCase()} 종목`;
    } catch {
      return `${m[1].toUpperCase()} 종목`;
    }
  }
  return path;
}

/** 구글 나라 코드(ISO 3자) → 2자 (한국어 이름용). 모르는 코드는 그대로. */
const A3: Record<string, string> = {
  usa: "US", kor: "KR", can: "CA", gbr: "GB", ind: "IN", deu: "DE", jpn: "JP", aus: "AU", fra: "FR", bra: "BR", sgp: "SG",
  hkg: "HK", chn: "CN", twn: "TW", phl: "PH", vnm: "VN", idn: "ID", mex: "MX", nld: "NL", esp: "ES", ita: "IT", che: "CH",
  swe: "SE", pol: "PL", tur: "TR", are: "AE", isr: "IL", nzl: "NZ", irl: "IE", pak: "PK", nga: "NG", zaf: "ZA", mys: "MY", tha: "TH",
};
const REGION = new Intl.DisplayNames(["ko"], { type: "region" });
function countryName(a3: string): string {
  const a2 = A3[a3.toLowerCase()];
  if (!a2) return a3.toUpperCase();
  try {
    return REGION.of(a2) ?? a2;
  } catch {
    return a2;
  }
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (x: number) => (x <= 0 ? "0%" : x < 0.1 ? `${(x * 100).toFixed(1)}%` : `${Math.round(x * 100)}%`);
const pos = (p: number | null) => (p == null || !Number.isFinite(p) ? "—" : `${p.toFixed(1)}위`);
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const DT = new Intl.DateTimeFormat("ko-KR", { timeZone: "America/Toronto", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : DT.format(d);
};

/** 축 눈금용 — 1 · 2 · 5 × 10^k 로 올림. */
function niceCeil(v: number): number {
  if (v <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

/** 기회 세 갈래 — 무엇이고 무엇을 하면 되는지 (영상의 방법을 이 사이트에 맞게). */
const KINDS: { kind: OppKind; title: string; what: string; how: string }[] = [
  {
    kind: "snippet",
    title: "순위는 높은데 잘 안 눌려요",
    what: "5위 안에 뜨는데, 클릭률이 그 순위에서 보통 나오는 값의 절반도 안 되는 검색어예요.",
    how: "할 일: 검색 결과에 보이는 제목 · 설명을 그 검색어에 맞게 고치기 (페이지 내용은 그대로).",
  },
  {
    kind: "near",
    title: "첫 페이지 문턱 (6~20위)",
    what: "첫 페이지 아래쪽이나 둘째 페이지에 뜨는 검색어예요. 사람들은 대부분 위쪽 몇 개만 눌러요.",
    how: "할 일: 그 페이지에 검색어가 묻는 내용을 보강하고, 방문자가 많은 페이지에서 링크를 걸어 주기.",
  },
  {
    kind: "guide",
    title: "노출은 쌓이는데 너무 뒤 (20위 밖)",
    what: "영상의 '노출 16,000 · 클릭 2' 같은 자리예요. 구글은 관련 있다고 보는데, 딱 맞는 답이 되는 페이지가 없어요.",
    how: "할 일: 그 검색어 하나에 답하는 안내 글을 새로 쓰고, 잘 되는 페이지에서 링크 걸기 (하루 하나씩).",
  },
];

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("/quant/admin/search");
  const sp = await searchParams;
  const range = RANGES.find((r) => String(r) === sp.range) ?? 28;
  const now = Date.now();
  const data = await readSearch(range, now);

  const head = (
    <>
      <AdminTabs current="search" />
      <div className="page-title adm-title">
        <div>
          <h1>관리 · 검색</h1>
          <p>구글 검색에서 어떤 검색어로 보이고 눌렸는지 · Google Search Console · 날짜는 구글 기준(미국 서부) · 열 때마다 새로 읽어요 ({HM.format(now)})</p>
        </div>
        <span className="adm-lock"><LockIcon />관리자만 · 구글 로그인</span>
      </div>
    </>
  );

  if (data.mode === "none") {
    return (
      <main className="container container--wide page adm">
        {head}
        <section className="card adm-card adm-v-setup">
          <h2>Search Console 이 아직 연결 안 됐어요</h2>
          <p className="adm-lead">
            구글이 &lsquo;읽기 전용 서비스 계정&rsquo;(사람이 아니라 프로그램용 구글 계정)으로 이 사이트의 검색 숫자를 읽게 해 주면 돼요. 한 번만 하면 돼요.
          </p>
          <ol>
            <li>
              <a href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noreferrer">Google Cloud 콘솔</a>
              {" "}→ 위쪽에서 프로젝트 고르기 (구글 로그인 만들 때 쓴 프로젝트도 돼요) → <b>Google Search Console API</b> → <b>사용</b>
            </li>
            <li>
              <b>IAM 및 관리자 → 서비스 계정 → 서비스 계정 만들기</b> (이름 예: seancho-search · 역할은 비워 두고 완료) → 만든 계정 →
              {" "}<b>키 → 키 추가 → 새 키 만들기 → JSON</b> → 파일이 내려받아져요
            </li>
            <li>
              <a href={`https://search.google.com/search-console/users?resource_id=${encodeURIComponent(GSC_SITE)}`} target="_blank" rel="noreferrer">
                Search Console → 설정 → 사용자 및 권한
              </a>
              {" "}→ <b>사용자 추가</b> → JSON 파일 안의 <code>client_email</code> (…@….iam.gserviceaccount.com) → 권한 <b>제한됨</b>
            </li>
            <li>
              Vercel → seancho 프로젝트 → <b>Settings → Environment Variables</b> → Key <code>GSC_SERVICE_ACCOUNT</code>, Value = JSON 파일 내용 전체 붙여넣기,
              {" "}<b>Type 은 Secret</b> (예전 이름 Sensitive · 저장 뒤엔 값이 안 보여요), Environments 는 <b>Production</b> → Save →
              {" "}<b>Deployments → 맨 위 배포 → Redeploy</b> (변수는 새 배포부터 들어가요)
            </li>
          </ol>
          <p className="adm-note adm-note--warn">
            JSON 키 파일은 비밀번호와 같아요 — 채팅 · GitHub 에 올리지 말고 Vercel 에만 넣어 주세요. 이 화면은 읽기 전용 권한만 써서
            Search Console 의 아무것도 바꾸지 못해요.
          </p>
        </section>
      </main>
    );
  }

  const minImpr = range === 7 ? 5 : range === 28 ? 10 : 20;
  const opps = opportunities(data.queries, data.queryPages, minImpr);
  const kindOf = new Map<string, OppKind>();
  for (const k of KINDS) for (const o of opps[k.kind]) kindOf.set(o.query, k.kind);
  const shortKind: Record<OppKind, string> = { snippet: "제목 · 설명", near: "내용 보강", guide: "안내 글" };

  const maxI = Math.max(0, ...data.days.map((d) => d.impressions));
  const top = niceCeil(maxI);
  const step = Math.max(1, Math.round(range / 4));
  const t = data.total;
  const none = !data.error && t.impressions === 0;

  return (
    <main className="container container--wide page adm">
      {head}

      {data.error && (
        <section className="card adm-card">
          <h2 className="adm-s-h2">구글에서 못 읽었어요</h2>
          <p className="adm-note adm-note--bad">{data.error}</p>
          {data.email && <p className="adm-lead">연결된 서비스 계정: <code>{data.email}</code></p>}
        </section>
      )}

      {!QUANT_INDEXABLE && (
        <p className="adm-note adm-note--plain">
          지금 /quant 검색 노출이 꺼져 있어요 (noindex · 11-25 12:43 ET 부터). 그래서 숫자가 거의 0인 게 정상이고, 이미 올라간
          페이지도 구글이 다시 읽으면서 며칠~몇 주 안에 빠져요. 다시 켜면 여기에 쌓여요 (lib/siteUrl.ts QUANT_INDEXABLE).
        </p>
      )}
      {QUANT_INDEXABLE && none && (
        <p className="adm-note adm-note--plain">
          아직 구글 검색 노출이 0이에요. 검색 노출을 켠 지 얼마 안 됐으면 정상이에요 — 구글이 페이지를 긁고(크롤링) 검색에 올리는 데
          며칠~몇 주 걸리고, 숫자는 2~3일 늦게 들어와요. 아래 &lsquo;구글에 올라갔나&rsquo;에서 진행 상황을 볼 수 있어요.
        </p>
      )}

      <div className="adm-sec adm-sec--tools">
        <h2>한눈에</h2>
        <span>{data.start.slice(5)} ~ {data.end.slice(5)}</span>
        <nav className="adm-range" aria-label="기간">
          {RANGES.map((r) => (
            <Link key={r} href={r === 28 ? "/quant/admin/search" : `/quant/admin/search?range=${r}`} prefetch={false}
              aria-current={range === r ? "true" : undefined} scroll={false}>
              {r}일
            </Link>
          ))}
        </nav>
      </div>
      <div className="adm-tiles">
        <div className="card adm-tile">
          <div className="adm-tile__k">노출</div>
          <div className="adm-tile__v">{fmt(t.impressions)}번</div>
          <div className="adm-tile__s">구글 검색 결과에 이 사이트 페이지가 보인 횟수 (스크롤해서 화면에 나온 것만)</div>
        </div>
        <div className="card adm-tile">
          <div className="adm-tile__k">클릭</div>
          <div className="adm-tile__v">{fmt(t.clicks)}번</div>
          <div className="adm-tile__s">그중 눌러서 사이트로 들어온 횟수</div>
        </div>
        <div className="card adm-tile">
          <div className="adm-tile__k">클릭률</div>
          <div className="adm-tile__v">{pct(t.ctr)}</div>
          <div className="adm-tile__s">클릭 ÷ 노출 — 보인 100번 중 몇 번 눌렸나</div>
        </div>
        <div className="card adm-tile">
          <div className="adm-tile__k">평균 순위</div>
          <div className="adm-tile__v">{pos(t.position)}</div>
          <div className="adm-tile__s">1위 = 맨 위 · 10위 = 첫 페이지 끝 · 노출 많은 검색어 쪽으로 기운 평균</div>
        </div>
      </div>

      <div className="adm-sec">
        <h2>하루 노출</h2>
        <span>막대에 올리면 그날 노출 · 클릭 · 최근 2~3일은 아직 덜 찼어요</span>
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
            <ol className="vbars__cols" aria-label={`최근 ${range}일 하루 노출`}>
              {data.days.map((d, i) => {
                const wd = WEEKDAY[new Date(`${d.date}T12:00:00Z`).getUTCDay()];
                const tip = `${d.date.slice(5)} (${wd}) · 노출 ${fmt(d.impressions)} · 클릭 ${fmt(d.clicks)}`;
                const edge = i < 4 ? "l" : i > data.days.length - 5 ? "r" : undefined;
                return (
                  <li key={d.date} className="vbars__col" tabIndex={0} aria-label={tip} data-edge={edge}>
                    <div className="vbars__bar" style={{ height: `${(d.impressions / top) * 100}%` }} />
                    <span className="vbars__tip" aria-hidden="true">{tip}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          <div />
          <div className="vbars__x num" aria-hidden="true">
            {data.days.map((d, i) => (
              <span key={d.date}>{i % step === 0 || i === data.days.length - 1 ? d.date.slice(5) : ""}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="adm-sec">
        <h2>기회 — 노출을 클릭으로</h2>
        <span>노출 {fmt(minImpr)}번 넘는 검색어만 · 갈래마다 노출 많은 순 · 하루에 하나씩 고치면 돼요</span>
      </div>
      <div className="adm-s-opps">
        {KINDS.map((k) => (
          <section key={k.kind} className="card adm-s-opp">
            <h3>{k.title}</h3>
            <p className="adm-s-opp__what">{k.what}</p>
            <p className="adm-s-opp__how">{k.how}</p>
            {opps[k.kind].length === 0 ? (
              <p className="muted adm-s-empty">아직 없어요 — 노출이 쌓이면 여기 떠요.</p>
            ) : (
              <ol>
                {opps[k.kind].map((o) => (
                  <li key={o.query}>
                    <div className="adm-s-q">{o.query}</div>
                    <div className="adm-s-meta num">
                      노출 {fmt(o.impressions)} · 클릭 {fmt(o.clicks)} · 클릭률 {pct(o.ctr)} · {pos(o.position)}
                      {o.page && (
                        <>
                          {" "}· <a href={o.page} target="_blank" rel="noreferrer">{pageName(o.page)}</a>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>

      <div className="adm-sec">
        <h2>검색어</h2>
        <span>노출 많은 순 · 50개까지 · 아주 드문 검색어는 구글이 개인정보 때문에 숨겨서 합계가 위 숫자보다 작을 수 있어요</span>
      </div>
      <RowsTable rows={data.queries.slice(0, 50)} label="검색어" render={(r) => (
        <>
          {r.keys[0]}
          {kindOf.has(r.keys[0]) && <span className="badge badge--warn adm-s-tag">{shortKind[kindOf.get(r.keys[0])!]}</span>}
        </>
      )} />

      <div className="adm-sec">
        <h2>페이지</h2>
        <span>노출 많은 순 · 30개까지</span>
      </div>
      <RowsTable rows={data.pages.slice(0, 30)} label="페이지" render={(r) => (
        <a href={r.keys[0]} target="_blank" rel="noreferrer">{pageName(r.keys[0])}</a>
      )} />

      <div className="adm-cols adm-s-cols">
        <section className="card adm-card">
          <h3 className="adm-s-h3">어느 나라에서 봤나</h3>
          {data.countries.length === 0 ? (
            <p className="muted adm-s-empty">아직 없어요</p>
          ) : (
            <ol className="adm-s-list">
              {data.countries.slice(0, 8).map((r) => (
                <li key={r.keys[0]}>
                  <span>{countryName(r.keys[0])}</span>
                  <span className="num muted">노출 {fmt(r.impressions)} · 클릭 {fmt(r.clicks)} · {pos(r.position)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <SitemapCard sitemaps={data.sitemaps} />
      </div>

      <div className="adm-sec">
        <h2>구글에 올라갔나</h2>
        <span>주요 화면 + 종목 페이지 몇 개 · 구글 &lsquo;URL 검사&rsquo; 결과 그대로</span>
      </div>
      <Suspense fallback={<section className="card adm-card"><p className="muted adm-s-empty">구글에 물어보는 중…</p></section>}>
        <IndexStatus />
      </Suspense>

      <p className="adm-note adm-note--plain adm-v-foot">
        숫자는 Google Search Console 그대로예요 (구글 검색만 · 네이버 · 빙은 빠져요). 최근 2~3일은 아직 덜 찼고, 날짜는 미국 서부 기준이에요.
        <br />
        &lsquo;순위는 높은데 잘 안 눌려요&rsquo;의 보통 클릭률은 업계 조사 평균을 둥글게 한 대략값이에요 (1위 28% · 2위 16% · 3위 11% · 4위 8% · 5위 6.5%).
        {data.email && (
          <>
            <br />
            연결된 서비스 계정 <code>{data.email}</code> · 읽기 전용{data.mode === "mock" ? " · 지금은 가짜 숫자 (로컬 확인용)" : ""}
          </>
        )}
        {data.mode === "mock" && !data.email && (
          <>
            <br />
            지금은 가짜 숫자예요 (로컬 확인용 GSC_MOCK=1).
          </>
        )}
      </p>
    </main>
  );
}

function RowsTable({ rows, label, render }: { rows: GscRow[]; label: string; render: (r: GscRow) => React.ReactNode }) {
  if (rows.length === 0) {
    return (
      <section className="card adm-card">
        <p className="muted adm-s-empty">아직 없어요</p>
      </section>
    );
  }
  return (
    <section className="card adm-tblcard">
      <div className="table-wrap">
        <table className="data-table adm-tbl adm-s-tbl">
          <thead>
            <tr>
              <th scope="col">{label}</th>
              <th scope="col" className="r">노출</th>
              <th scope="col" className="r">클릭</th>
              <th scope="col" className="r">클릭률</th>
              <th scope="col" className="r">평균 순위</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.keys.join("|")}>
                <td className="adm-s-key">{render(r)}</td>
                <td className="num r">{fmt(r.impressions)}</td>
                <td className="num r">{fmt(r.clicks)}</td>
                <td className="num r">{pct(r.ctr)}</td>
                <td className="num r">{pos(r.position)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SitemapCard({ sitemaps }: { sitemaps: SitemapInfo[] }) {
  return (
    <section className="card adm-card">
      <h3 className="adm-s-h3">사이트맵</h3>
      {sitemaps.length === 0 ? (
        <p className="muted adm-s-empty">
          제출한 사이트맵이 없어요 — Search Console → Sitemaps 에 <code>sitemap.xml</code> 을 넣고 SUBMIT.
        </p>
      ) : (
        sitemaps.map((s) => {
          const submitted = s.contents?.reduce((a, c) => a + (Number(c.submitted) || 0), 0) ?? 0;
          const errors = Number(s.errors) || 0;
          const warnings = Number(s.warnings) || 0;
          return (
            <dl key={s.path} className="adm-s-dl">
              <dt>주소</dt>
              <dd>{s.path.replace(SITE, "") || s.path}</dd>
              <dt>구글이 읽은 때</dt>
              <dd className="num">{s.isPending ? "아직 처리 중" : dt(s.lastDownloaded)}</dd>
              <dt>알려 준 페이지</dt>
              <dd className="num">{fmt(submitted)}개</dd>
              <dt>오류 · 경고</dt>
              <dd className={errors ? "adm-old" : undefined}>{errors || warnings ? `오류 ${errors} · 경고 ${warnings}` : "없음"}</dd>
            </dl>
          );
        })
      )}
      <p className="adm-s-small muted">실제로 검색에 올라간 수는 Search Console 화면의 &lsquo;페이지&rsquo; 메뉴에서 봐요 (API 가 더는 안 알려 줘요).</p>
    </section>
  );
}

/** 구글 '색인 생성 범위' 문구 → 짧은 한국어 꼬리표 + 색. */
function indexLabel(i: Inspection): { text: string; tone: "good" | "mid" | "warn" | "bad" } {
  if (i.error) return { text: "못 물어봄", tone: "bad" };
  const c = (i.coverage ?? "").toLowerCase();
  if (i.verdict === "PASS" || c.includes("indexed, not submitted") || c === "submitted and indexed") return { text: "검색에 있음", tone: "good" };
  if (c.includes("unknown")) return { text: "구글이 아직 모름", tone: "mid" };
  if (c.includes("discovered")) return { text: "주소만 앎 (아직 안 긁음)", tone: "mid" };
  if (c.includes("crawled")) return { text: "긁었지만 아직 안 올림", tone: "mid" };
  if (c.includes("noindex")) return { text: "noindex 로 빠짐", tone: "warn" };
  if (c.includes("redirect")) return { text: "다른 주소로 넘어감", tone: "mid" };
  if (c.includes("canonical") || c.includes("duplicate")) return { text: "다른 주소를 대표로 봄", tone: "warn" };
  if (i.verdict === "FAIL") return { text: "문제 있음", tone: "bad" };
  return { text: i.coverage ?? "모름", tone: "mid" };
}

async function IndexStatus() {
  const rows = await inspectUrls(INSPECT.map((p) => SITE + p));
  if (rows.length === 0) return null;
  const firstErr = rows.find((r) => r.error)?.error;
  return (
    <section className="card adm-tblcard">
      {firstErr && rows.every((r) => r.error) && <p className="adm-note adm-note--bad">{firstErr}</p>}
      <div className="table-wrap">
        <table className="data-table adm-tbl adm-s-tbl">
          <thead>
            <tr>
              <th scope="col">페이지</th>
              <th scope="col">상태</th>
              <th scope="col" className="adm-s-cov">구글 문구</th>
              <th scope="col" className="r">마지막으로 긁은 때</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const l = indexLabel(r);
              return (
                <tr key={r.url}>
                  <td><a href={r.url} target="_blank" rel="noreferrer">{pageName(r.url)}</a></td>
                  <td><span className={`badge badge--${l.tone}`}>{l.text}</span></td>
                  <td className="adm-s-small adm-s-cov">{r.error ?? r.coverage ?? "—"}</td>
                  <td className="num r">{dt(r.lastCrawl)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
