import "server-only";
import { createSign } from "node:crypto";

/**
 * Google Search Console (2026-11-25) — 관리 · 검색 탭 (/quant/admin/search).
 * 구글 검색에서 이 사이트가 어떤 검색어로 몇 번 보였고(노출) 몇 번 눌렸는지(클릭) · 평균 몇 위였는지 · 페이지가 구글에
 * 올라갔는지(색인)를 읽는다. 사용자가 본 영상의 방법(노출은 많은데 클릭이 적은 검색어 → 그 검색어에 맞게 페이지를 고친다)을
 * 화면에서 바로 하도록 '기회' 목록도 만든다 (opportunities).
 *
 * 연결: 서비스 계정 JSON 키 → Vercel 환경변수 GSC_SERVICE_ACCOUNT (파일 내용 전체 · Type 은 Secret, 예전 이름 Sensitive). 그 계정 이메일을 Search Console
 * 속성(https://seancho.vercel.app/) → 설정 → 사용자 및 권한에 '제한됨'으로 추가해야 읽힌다. 범위는 읽기 전용
 * (webmasters.readonly) — 이 코드로는 Search Console 의 아무것도 바꿀 수 없다. 키는 서버에서만 쓰고 브라우저로 보내지 않는다.
 * GSC_MOCK=1 = 가짜 숫자 (로컬에서 화면 확인용 · 운영에선 쓰지 않는다).
 */

/** Search Console 속성 주소 (URL 접두어 속성 — 끝의 '/' 까지 같아야 한다). */
export const GSC_SITE = (process.env.GSC_SITE_URL || "https://seancho.vercel.app/").trim();
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API = "https://www.googleapis.com/webmasters/v3";

type Creds = { email: string; key: string };

function creds(): Creds | null {
  const raw = process.env.GSC_SERVICE_ACCOUNT?.trim();
  if (raw) {
    try {
      const j = JSON.parse(raw) as { client_email?: string; private_key?: string };
      if (j.client_email && j.private_key) return { email: j.client_email, key: j.private_key };
    } catch {
      // JSON 이 아니면 아래 두 변수로
    }
  }
  const email = process.env.GSC_CLIENT_EMAIL?.trim();
  const key = process.env.GSC_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  return email && key ? { email, key } : null;
}

/** 'api' 연결됨 · 'mock' 로컬 가짜 숫자 · 'none' 연결 안 됨. */
export function gscMode(): "api" | "mock" | "none" {
  if (creds()) return "api";
  return process.env.GSC_MOCK === "1" ? "mock" : "none";
}

/** 연결된 서비스 계정 이메일 (비밀 아님 — 안내 문구에 쓴다). 환경변수가 이상하면 null. */
export function gscEmail(): string | null {
  return creds()?.email ?? null;
}

// ── 인증 (서비스 계정 → 1시간짜리 접근 토큰) ────────────────────

let token: { value: string; exp: number } | null = null;
const b64url = (s: string) => Buffer.from(s).toString("base64url");

async function accessToken(c: Creds): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (token && token.exp - 120 > now) return token.value;
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: c.email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }),
  );
  let sig: string;
  try {
    sig = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(c.key).toString("base64url");
  } catch {
    throw new Error("키 모양이 이상해요 — GSC_SERVICE_ACCOUNT 에 JSON 키 파일 내용을 통째로 넣었는지 확인해 주세요.");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${sig}` }),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !j.access_token) throw new Error(`구글 인증 실패 — ${j.error_description ?? j.error ?? res.status}`);
  token = { value: j.access_token, exp: now + (j.expires_in ?? 3600) };
  return token.value;
}

/** 구글 오류 → 무엇을 하면 되는지 한 줄. */
function explain(status: number, body: string, email: string): string {
  let msg = body;
  try {
    msg = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? body;
  } catch {
    // 글 그대로
  }
  if (/has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(msg)) {
    return "Google Cloud 에서 'Google Search Console API' 를 사용 설정해야 해요 (키를 만든 그 프로젝트에서).";
  }
  if (status === 403 || status === 401) {
    return `Search Console 에 이 서비스 계정이 사용자로 없어요 — Search Console → 설정 → 사용자 및 권한 → 사용자 추가: ${email}`;
  }
  return `구글 API 오류 ${status} — ${msg.slice(0, 200)}`;
}

async function call<T>(url: string, body?: unknown): Promise<T> {
  const c = creds();
  if (!c) throw new Error("연결 안 됨");
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${await accessToken(c)}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(explain(res.status, await res.text(), c.email));
  return (await res.json()) as T;
}

// ── 검색 실적 ───────────────────────────────────────────────

/** 한 줄 — keys 는 고른 칸 순서 (검색어 · 페이지 · 날짜 · 나라). ctr = 클릭 ÷ 노출 (0~1), position = 평균 순위 (1 = 맨 위). */
export type GscRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

export type SitemapInfo = {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  errors?: string | number;
  warnings?: string | number;
  contents?: { type?: string; submitted?: string; indexed?: string }[];
};

export type SearchData = {
  mode: "api" | "mock" | "none";
  email: string | null;
  error: string | null;
  start: string;
  end: string;
  /** 날짜별 합계 (오래된 날 → 최근, 빈 날은 0) */
  days: { date: string; clicks: number; impressions: number }[];
  total: { clicks: number; impressions: number; ctr: number; position: number | null };
  queries: GscRow[];
  pages: GscRow[];
  /** [검색어, 페이지] — 기회 목록에서 그 검색어로 어떤 페이지가 떴는지 */
  queryPages: GscRow[];
  countries: GscRow[];
  sitemaps: SitemapInfo[];
};

/** 구글 Search Console 날짜는 미국 서부 시간 기준. */
const PT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" });

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 최근 range 일 (오늘 포함 · 구글은 최근 2~3일이 아직 덜 찼다) 검색 실적 + 사이트맵. 실패하면 error 에 이유. */
export async function readSearch(range: number, now = Date.now()): Promise<SearchData> {
  const mode = gscMode();
  const end = PT.format(now);
  const start = addDays(end, -(range - 1));
  const empty: SearchData = {
    mode,
    email: gscEmail(),
    error: null,
    start,
    end,
    days: [],
    total: { clicks: 0, impressions: 0, ctr: 0, position: null },
    queries: [],
    pages: [],
    queryPages: [],
    countries: [],
    sitemaps: [],
  };
  if (mode === "none") return empty;

  let raw: { date: GscRow[]; query: GscRow[]; page: GscRow[]; qp: GscRow[]; country: GscRow[]; sitemaps: SitemapInfo[] };
  try {
    if (mode === "mock") {
      raw = mockRaw(start, range);
    } else {
      const site = encodeURIComponent(GSC_SITE);
      const q = (dimensions: string[], rowLimit: number) =>
        call<{ rows?: GscRow[] }>(`${API}/sites/${site}/searchAnalytics/query`, {
          startDate: start,
          endDate: end,
          dimensions,
          rowLimit,
          dataState: "all", // 아직 확정 안 된 최근 2~3일도
        }).then((j) => j.rows ?? []);
      const [date, query, page, qp, country, sm] = await Promise.all([
        q(["date"], range + 5),
        q(["query"], 500),
        q(["page"], 300),
        q(["query", "page"], 2000),
        q(["country"], 20),
        call<{ sitemap?: SitemapInfo[] }>(`${API}/sites/${site}/sitemaps`).then((j) => j.sitemap ?? []),
      ]);
      raw = { date, query, page, qp, country, sitemaps: sm };
    }
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }

  const byDate = new Map(raw.date.map((r) => [r.keys[0], r]));
  const days = Array.from({ length: range }, (_, i) => {
    const date = addDays(start, i);
    const r = byDate.get(date);
    return { date, clicks: r?.clicks ?? 0, impressions: r?.impressions ?? 0 };
  });
  const clicks = raw.date.reduce((a, r) => a + r.clicks, 0);
  const impressions = raw.date.reduce((a, r) => a + r.impressions, 0);
  // 평균 순위 = 노출로 가중한 평균 (Search Console 화면의 '평균 게재순위'와 같은 방식)
  const position = impressions ? raw.date.reduce((a, r) => a + r.position * r.impressions, 0) / impressions : null;
  const byImpr = (a: GscRow, b: GscRow) => b.impressions - a.impressions || b.clicks - a.clicks;
  return {
    ...empty,
    days,
    total: { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position },
    queries: [...raw.query].sort(byImpr),
    pages: [...raw.page].sort(byImpr),
    queryPages: raw.qp,
    countries: [...raw.country].sort(byImpr),
    sitemaps: raw.sitemaps,
  };
}

// ── 기회 — 노출을 클릭으로 바꿀 자리 ─────────────────────────────

/**
 * 순위별 보통 클릭률 (업계 조사 평균을 둥글게 — 대략값). '순위는 높은데 덜 눌리는' 검색어를 고를 때 기준으로만 쓴다.
 * 1위 28% · 2위 16% · 3위 11% · 4위 8% · 5위 6.5% · 6~7위 4.5% · 8~10위 3% · 11~20위 1% · 그 아래 0.3%.
 */
export function typicalCtr(position: number): number {
  if (position < 1.5) return 0.28;
  if (position < 2.5) return 0.16;
  if (position < 3.5) return 0.11;
  if (position < 4.5) return 0.08;
  if (position < 5.5) return 0.065;
  if (position < 7.5) return 0.045;
  if (position < 10.5) return 0.03;
  if (position < 20.5) return 0.01;
  return 0.003;
}

export type OppKind = "snippet" | "near" | "guide";
export type Opportunity = GscRow & { query: string; page: string | null; kind: OppKind };

/**
 * 영상의 방법을 세 갈래로:
 *   snippet — 5위 안인데 클릭률이 보통의 절반도 안 됨 → 검색 결과에 보이는 제목 · 설명을 고친다
 *   near    — 6~20위 (첫 페이지 아래쪽 · 둘째 페이지) → 그 페이지 내용 보강 + 잘 되는 페이지에서 내부 링크
 *   guide   — 20위 밖인데 노출이 쌓임 → 그 검색어에 답하는 전용 안내 글을 새로 쓴다 (영상의 '노출 16,000 · 클릭 2' 자리)
 * minImpr 보다 노출이 적은 검색어는 우연일 수 있어 뺀다. 갈래마다 노출 많은 순 최대 limit 개.
 */
export function opportunities(queries: GscRow[], queryPages: GscRow[], minImpr: number, limit = 10): Record<OppKind, Opportunity[]> {
  const topPage = new Map<string, GscRow>();
  for (const r of queryPages) {
    const cur = topPage.get(r.keys[0]);
    if (!cur || r.impressions > cur.impressions) topPage.set(r.keys[0], r);
  }
  const out: Record<OppKind, Opportunity[]> = { snippet: [], near: [], guide: [] };
  for (const r of queries) {
    if (r.impressions < minImpr) continue;
    const kind: OppKind | null =
      r.position < 5.5 ? (r.ctr < typicalCtr(r.position) / 2 ? "snippet" : null) : r.position <= 20 ? "near" : "guide";
    if (!kind) continue;
    out[kind].push({ ...r, query: r.keys[0], page: topPage.get(r.keys[0])?.keys[1] ?? null, kind });
  }
  for (const k of Object.keys(out) as OppKind[]) out[k] = out[k].sort((a, b) => b.impressions - a.impressions).slice(0, limit);
  return out;
}

// ── 색인 상태 (URL 검사) ───────────────────────────────────────

export type Inspection = {
  url: string;
  verdict: string | null; // PASS · NEUTRAL · FAIL · PARTIAL
  coverage: string | null; // 'Submitted and indexed' · 'Discovered - currently not indexed' … (구글 문구)
  lastCrawl: string | null;
  error: string | null;
};

type InspectReply = {
  inspectionResult?: { indexStatusResult?: { verdict?: string; coverageState?: string; lastCrawlTime?: string } };
};

/** 주소마다 구글 색인 상태 (하루 2,000번까지 · 화면을 열 때만 부른다). 하나가 실패해도 나머지는 보여 준다. */
export async function inspectUrls(urls: string[]): Promise<Inspection[]> {
  const mode = gscMode();
  if (mode === "none") return [];
  if (mode === "mock") return urls.map(mockInspection);
  return Promise.all(
    urls.map(async (url): Promise<Inspection> => {
      try {
        const j = await call<InspectReply>("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
          inspectionUrl: url,
          siteUrl: GSC_SITE,
          languageCode: "en-US", // 상태 문구를 영어로 받아 화면에서 한국어 꼬리표로 바꾼다 (번역 문구는 맞추기 어렵다)
        });
        const s = j.inspectionResult?.indexStatusResult;
        return { url, verdict: s?.verdict ?? null, coverage: s?.coverageState ?? null, lastCrawl: s?.lastCrawlTime ?? null, error: null };
      } catch (e) {
        return { url, verdict: null, coverage: null, lastCrawl: null, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}

// ── 가짜 숫자 (GSC_MOCK=1 · 로컬 화면 확인용) ─────────────────────

function mockRaw(start: string, range: number) {
  const site = GSC_SITE.replace(/\/$/, "");
  const Q: [string, string, number, number, number][] = [
    // 검색어, 페이지, 노출, 클릭, 평균 순위
    ["pltr stock analysis", "/quant/stock/PLTR", 1840, 6, 4.2],
    ["palantir stock", "/quant/stock/PLTR", 16020, 2, 48.3],
    ["crwv insider selling", "/quant/stock/CRWV", 410, 9, 7.8],
    ["xom congress trades", "/quant/congress", 260, 4, 11.4],
    ["ry.to valuation", "/quant/stock/RY.TO", 95, 1, 13.9],
    ["golden cross screener", "/quant/universe", 520, 0, 34.0],
    ["squeeze momentum weekly scanner", "/quant/universe", 140, 3, 18.2],
    ["seancho quant", "/quant", 40, 22, 1.1],
    ["nvda pe vs industry", "/quant/stock/NVDA", 70, 0, 2.6],
    ["tsxv stock screener", "/quant/universe", 33, 0, 26.5],
  ];
  const tot = Q.reduce((a, q) => a + q[2], 0);
  const totC = Q.reduce((a, q) => a + q[3], 0);
  const row = (keys: string[], impressions: number, clicks: number, position: number): GscRow => ({
    keys,
    impressions,
    clicks,
    ctr: impressions ? clicks / impressions : 0,
    position,
  });
  const date = Array.from({ length: Math.max(0, range - 2) }, (_, i) => {
    const w = (i + 1) / range;
    return row([addDays(start, i)], Math.round((tot / range) * 2 * w), Math.round((totC / range) * 2 * w), 20 - w * 6);
  });
  const pages = new Map<string, GscRow>();
  for (const [, p, imp, c, pos] of Q) {
    const r = pages.get(p) ?? row([site + p], 0, 0, 0);
    r.position = (r.position * r.impressions + pos * imp) / (r.impressions + imp);
    r.impressions += imp;
    r.clicks += c;
    r.ctr = r.clicks / r.impressions;
    pages.set(p, r);
  }
  return {
    date,
    query: Q.map(([q, , imp, c, pos]) => row([q], imp, c, pos)),
    page: [...pages.values()],
    qp: Q.map(([q, p, imp, c, pos]) => row([q, site + p], imp, c, pos)),
    country: [row(["usa"], Math.round(tot * 0.7), 20, 22), row(["kor"], Math.round(tot * 0.2), 24, 9), row(["can"], Math.round(tot * 0.1), 3, 15)],
    sitemaps: [
      { path: `${site}/sitemap.xml`, lastSubmitted: "2026-11-25T17:10:00Z", lastDownloaded: "2026-11-25T17:12:00Z", isPending: false,
        errors: "0", warnings: "0", contents: [{ type: "web", submitted: "7399", indexed: "0" }] },
    ],
  };
}

function mockInspection(url: string, i: number): Inspection {
  const states: [string, string][] = [
    ["PASS", "Submitted and indexed"],
    ["NEUTRAL", "Discovered - currently not indexed"],
    ["NEUTRAL", "Crawled - currently not indexed"],
    ["NEUTRAL", "URL is unknown to Google"],
  ];
  const [verdict, coverage] = states[i % states.length];
  return { url, verdict, coverage, lastCrawl: verdict === "PASS" ? "2026-11-25T18:30:00Z" : null, error: null };
}
