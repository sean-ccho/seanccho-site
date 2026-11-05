/**
 * 방문 기록 (2026-11-05) — 관리 · 방문자 탭 (/quant/admin/visitors).
 *
 * 브라우저(components/VisitTracker.tsx)가 페이지마다 /api/visit 로 짧은 기록을 보내면, 서버가 Vercel 위치 헤더와
 * User-Agent 로 나라·도시·기기·브라우저를 붙여 Upstash Redis 에 넣는다. **IP 는 어디에도 저장하지 않는다.**
 * 같은 사람인지는 브라우저 localStorage 의 무작위 번호(v)로만 안다 — 사람을 특정하지 못하고, 방문 기록을 지우면 새 사람.
 *
 * 저장 (방문 1건 = Redis 요청 1번):
 *   v:log            최근 이벤트 JSON 리스트 (LPUSH · 최근 LOG_MAX 건만)
 *   v:d:YYYY-MM-DD   그날(토론토) 집계 해시 — pv · s(방문) · n(처음 온 사람) · p:경로 · r:유입 · c:나라 · ct:나라|도시 · d:기기 · b:브라우저
 *   v:u:YYYY-MM-DD   그날 방문자 HyperLogLog — 여러 날 PFCOUNT = 기간 방문자 수
 *
 * 저장소: Vercel Marketplace 의 Upstash Redis (KV_REST_API_URL/TOKEN 또는 UPSTASH_REDIS_REST_URL/TOKEN).
 * 없으면 기록은 조용히 건너뛰고 방문자 탭이 '연결 안 됨'을 보여 준다. VISITS_MEMORY=1 이면 메모리에 (로컬 확인용).
 */

export const LOG_MAX = 5000;
const DAY_TTL = 400 * 86_400; // 일별 집계 보관 (초)
const TZ = "America/Toronto";
const YMD = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

/** 토론토 날짜 'YYYY-MM-DD'. */
export const torontoDay = (t: number) => YMD.format(t);

/** 브라우저가 보내는 것. */
export type VisitPayload = {
  v: string; // 방문자 번호 (브라우저 무작위)
  s: string; // 방문(세션) 번호 — 30분 쉬면 새 번호
  p: string; // 경로 (쿼리 없이)
  f: 0 | 1; // 이 방문의 첫 페이지
  n: 0 | 1; // 이 브라우저의 첫 방문
  g: number | null; // 다시 온 사람 — 지난 방문 며칠 전 (첫 페이지에서만)
  r: string; // 밖에서 들어온 주소의 호스트 (첫 페이지에서만, 없으면 '')
  u: string; // utm_source (첫 페이지에서만)
  l: string; // 브라우저 언어
};

/** 저장되는 한 건 = 보낸 것 + 서버가 붙인 것. */
export type VisitEvent = VisitPayload & {
  t: number; // 받은 시각 (ms)
  cc: string; // 나라 코드 (Vercel x-vercel-ip-country)
  rg: string; // 주·지역 코드
  ci: string; // 도시
  d: string; // 기기 — iPhone · Android 폰 · Mac · Windows …
  b: string; // 브라우저 — Safari · Chrome · 카카오톡 …
};

// ── 받은 값 검사 ──────────────────────────────────────────────

const ID = /^[a-z0-9]{8,32}$/i;
const HOST = /^[a-z0-9.-]{1,100}$/i;
const SHORT = /^[\w.\-]{0,40}$/;
const LANG = /^[a-z]{2,3}(-[a-z0-9]{2,8}){0,2}$/i;

/** 브라우저가 보낸 JSON → 검사한 payload (이상하면 null). */
export function parsePayload(raw: unknown): VisitPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  const bit = (k: string): 0 | 1 => (o[k] === 1 ? 1 : 0);
  const v = str("v");
  const s = str("s");
  const p = str("p").split(/[?#]/)[0];
  if (!ID.test(v) || !ID.test(s)) return null;
  if (!p.startsWith("/") || p.length > 200 || /\s/.test(p)) return null;
  const r = str("r").toLowerCase();
  const u = str("u").slice(0, 40);
  const l = str("l");
  const g = typeof o.g === "number" && Number.isInteger(o.g) && o.g >= 0 && o.g <= 3650 ? o.g : null;
  return {
    v,
    s,
    p,
    f: bit("f"),
    n: bit("n"),
    g,
    r: HOST.test(r) ? r : "",
    u: SHORT.test(u) ? u : "",
    l: LANG.test(l) ? l : "",
  };
}

// ── User-Agent ───────────────────────────────────────────────

/** 사람이 아닌 것 (검색 로봇 · 미리보기 · 점검 도구 · 스크립트). JS 를 안 돌리는 로봇은 애초에 안 온다. */
const BOT = /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|python|curl|wget|httpclient|axios|node-fetch|undici|go-http|java\/|okhttp|preview|facebookexternalhit|embedly|vercel|daumoa|yeti|mediapartners|phantom|selenium|puppeteer|playwright/i;

export const isBot = (ua: string) => !ua || BOT.test(ua);

/** 기기 + 브라우저 (짧은 한국어 이름). */
export function parseUa(ua: string): { d: string; b: string } {
  let d = "기타";
  if (/iPhone|iPod/.test(ua)) d = "iPhone";
  else if (/iPad/.test(ua)) d = "iPad";
  else if (/Android/.test(ua)) d = /Mobile/.test(ua) ? "Android 폰" : "Android 태블릿";
  else if (/CrOS/.test(ua)) d = "Chromebook";
  else if (/Macintosh|Mac OS X/.test(ua)) d = "Mac";
  else if (/Windows/.test(ua)) d = "Windows";
  else if (/Linux/.test(ua)) d = "Linux";

  // 앱 안 브라우저를 먼저 (UA 에 Safari · Chrome 도 같이 들어 있다)
  let b = "기타";
  if (/KAKAOTALK/i.test(ua)) b = "카카오톡";
  else if (/NAVER\(inapp|NAVER/.test(ua)) b = "네이버 앱";
  else if (/Instagram/.test(ua)) b = "인스타그램";
  else if (/FBAN|FBAV|FB_IAB/.test(ua)) b = "페이스북";
  else if (/\bLine\//.test(ua)) b = "라인";
  else if (/DaumApps/.test(ua)) b = "다음 앱";
  else if (/SamsungBrowser/.test(ua)) b = "삼성 인터넷";
  else if (/Whale\//.test(ua)) b = "웨일";
  else if (/EdgA?\/|EdgiOS/.test(ua)) b = "Edge";
  else if (/OPR\/|Opera/.test(ua)) b = "Opera";
  else if (/Firefox|FxiOS/.test(ua)) b = "Firefox";
  else if (/CriOS|Chrome\//.test(ua)) b = "Chrome";
  else if (/Safari\//.test(ua)) b = "Safari";
  return { d, b };
}

// ── Redis (Upstash REST) ─────────────────────────────────────

type Cmd = (string | number)[];
type Reply = { result?: unknown; error?: string };

function restConfig(): { url: string; token: string } | null {
  const url = (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "").trim();
  const token = (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "").trim();
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

const useMemory = () => process.env.VISITS_MEMORY === "1";

/** 저장소 상태 — 'redis' 연결됨 · 'memory' 로컬 확인용 · 'none' 연결 안 됨. */
export function storeMode(): "redis" | "memory" | "none" {
  if (restConfig()) return "redis";
  return useMemory() ? "memory" : "none";
}

async function pipeline(cmds: Cmd[]): Promise<unknown[]> {
  const cfg = restConfig();
  if (!cfg) {
    if (useMemory()) return cmds.map(memoryExec);
    throw new Error("저장소 연결 안 됨");
  }
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
    body: JSON.stringify(cmds.map((c) => c.map(String))),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  const out = (await res.json()) as Reply[];
  const bad = out.find((r) => r.error);
  if (bad) throw new Error(`Redis ${bad.error}`);
  return out.map((r) => r.result);
}

// 로컬 확인용 (VISITS_MEMORY=1) — 쓰는 명령만 흉내. 서버를 끄면 사라진다.
// 라우트마다 번들이 따로라 모듈 변수는 /api/visit 와 화면이 서로 다르다 → 프로세스 전체(globalThis)에 하나.
type Mem = { lists: Map<string, string[]>; hashes: Map<string, Map<string, number>>; sets: Map<string, Set<string>> };
const g = globalThis as typeof globalThis & { __scVisitMem?: Mem };
const mem: Mem = (g.__scVisitMem ??= { lists: new Map(), hashes: new Map(), sets: new Map() });

function memoryExec(cmd: Cmd): unknown {
  const [op, key, ...a] = cmd.map(String);
  switch (op) {
    case "LPUSH": {
      const l = mem.lists.get(key) ?? [];
      l.unshift(...a.reverse());
      mem.lists.set(key, l);
      return l.length;
    }
    case "LTRIM": {
      const l = mem.lists.get(key) ?? [];
      mem.lists.set(key, l.slice(Number(a[0]), Number(a[1]) + 1));
      return "OK";
    }
    case "LRANGE":
      return (mem.lists.get(key) ?? []).slice(Number(a[0]), Number(a[1]) + 1);
    case "HINCRBY": {
      const h = mem.hashes.get(key) ?? new Map<string, number>();
      h.set(a[0], (h.get(a[0]) ?? 0) + Number(a[1]));
      mem.hashes.set(key, h);
      return h.get(a[0]);
    }
    case "HGETALL":
      return [...(mem.hashes.get(key) ?? new Map<string, number>())].flatMap(([k, v]) => [k, String(v)]);
    case "PFADD": {
      const s = mem.sets.get(key) ?? new Set<string>();
      a.forEach((x) => s.add(x));
      mem.sets.set(key, s);
      return 1;
    }
    case "PFCOUNT":
      return new Set([key, ...a].flatMap((k) => [...(mem.sets.get(k) ?? [])])).size;
    case "EXPIRE":
      return 1;
    default:
      throw new Error(`memory: ${op}`);
  }
}

// ── 쓰기 ─────────────────────────────────────────────────────

/** 한 건 저장. 첫 페이지면 방문 단위 집계(유입 · 나라 · 기기 …)도 더한다. */
export async function recordVisit(ev: VisitEvent): Promise<void> {
  const day = torontoDay(ev.t);
  const dk = `v:d:${day}`;
  const uk = `v:u:${day}`;
  const cmds: Cmd[] = [
    ["LPUSH", "v:log", JSON.stringify(ev)],
    ["LTRIM", "v:log", 0, LOG_MAX - 1],
    ["HINCRBY", dk, "pv", 1],
    ["HINCRBY", dk, `p:${ev.p}`, 1],
    ["PFADD", uk, ev.v],
  ];
  if (ev.f) {
    cmds.push(
      ["HINCRBY", dk, "s", 1],
      ["HINCRBY", dk, `r:${sourceOf(ev)}`, 1],
      ["HINCRBY", dk, `c:${ev.cc || "?"}`, 1],
      ["HINCRBY", dk, `ct:${ev.cc || "?"}|${ev.ci}`, 1],
      ["HINCRBY", dk, `d:${ev.d}`, 1],
      ["HINCRBY", dk, `b:${ev.b}`, 1],
    );
    if (ev.n) cmds.push(["HINCRBY", dk, "n", 1]);
  }
  cmds.push(["EXPIRE", dk, DAY_TTL], ["EXPIRE", uk, DAY_TTL]);
  await pipeline(cmds);
}

// ── 유입 경로 이름 ──────────────────────────────────────────

const SOURCES: [RegExp, string][] = [
  [/(^|\.)google\./, "구글"],
  [/(^|\.)naver\.(com|me)$/, "네이버"],
  [/(^|\.)(daum\.net|kakao\.com)$/, "다음 · 카카오"],
  [/(^|\.)bing\.com$/, "빙"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "X(트위터)"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "페이스북"],
  [/(^|\.)instagram\.com$/, "인스타그램"],
  [/(^|\.)threads\.(net|com)$/, "스레드"],
  [/(^|\.)reddit\.com$/, "레딧"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "유튜브"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "링크드인"],
  [/(^|\.)github\.com$/, "GitHub"],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, "ChatGPT"],
  [/(^|\.)claude\.ai$/, "Claude"],
  [/(^|\.)perplexity\.ai$/, "Perplexity"],
  [/(^|\.)tradingview\.com$/, "TradingView"],
];

/** 들어온 곳이 없는 방문 (주소를 직접 쳤거나 즐겨찾기 · 앱 밖 링크). */
export const DIRECT = "직접 · 즐겨찾기";

/** 이 방문이 어디서 왔나 — 알려진 곳은 이름, 아니면 호스트, 앱 안 브라우저는 그 앱, 없으면 '직접'. */
export function sourceOf(ev: Pick<VisitEvent, "r" | "u" | "b">): string {
  if (ev.r) {
    const host = ev.r.replace(/^www\.|^m\./, "");
    return SOURCES.find(([re]) => re.test(host))?.[1] ?? host;
  }
  if (ev.u) return ev.u;
  if (["카카오톡", "네이버 앱", "인스타그램", "페이스북", "라인", "다음 앱"].includes(ev.b)) return ev.b;
  return DIRECT;
}

// ── 읽기 (관리 화면) ────────────────────────────────────────

export type DayStat = {
  date: string;
  pv: number;
  sessions: number;
  visitors: number;
  newVisitors: number;
  fields: Record<string, number>;
};

export type VisitorData = {
  mode: "redis" | "memory" | "none";
  error: string | null;
  events: VisitEvent[];
  /** 오래된 날 → 오늘 */
  days: DayStat[];
  visitors7: number;
  visitors30: number;
};

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 최근 이벤트 `logN` 건 + 30일 집계 — Redis 요청 1번. */
export async function readVisitors(now: number, logN = 3000): Promise<VisitorData> {
  const mode = storeMode();
  const empty: VisitorData = { mode, error: null, events: [], days: [], visitors7: 0, visitors30: 0 };
  if (mode === "none") return empty;
  const today = torontoDay(now);
  const dates = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const cmds: Cmd[] = [
    ["LRANGE", "v:log", 0, Math.min(logN, LOG_MAX) - 1],
    ...dates.flatMap((d): Cmd[] => [["HGETALL", `v:d:${d}`], ["PFCOUNT", `v:u:${d}`]]),
    ["PFCOUNT", ...dates.slice(-7).map((d) => `v:u:${d}`)],
    ["PFCOUNT", ...dates.map((d) => `v:u:${d}`)],
  ];
  let out: unknown[];
  try {
    out = await pipeline(cmds);
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }
  const events: VisitEvent[] = [];
  for (const line of (out[0] as string[] | null) ?? []) {
    try {
      events.push(JSON.parse(line) as VisitEvent);
    } catch {
      // 깨진 줄은 건너뜀
    }
  }
  const days = dates.map((date, i): DayStat => {
    const flat = (out[1 + i * 2] as string[] | null) ?? [];
    const fields: Record<string, number> = {};
    for (let k = 0; k + 1 < flat.length; k += 2) fields[flat[k]] = Number(flat[k + 1]) || 0;
    return {
      date,
      pv: fields.pv ?? 0,
      sessions: fields.s ?? 0,
      newVisitors: fields.n ?? 0,
      visitors: Number(out[2 + i * 2]) || 0,
      fields,
    };
  });
  return {
    mode,
    error: null,
    events,
    days,
    visitors7: Number(out[1 + dates.length * 2]) || 0,
    visitors30: Number(out[2 + dates.length * 2]) || 0,
  };
}
