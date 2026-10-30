import type { Lang } from "./i18n";
import { prepForMt, translateKo, type Protect } from "./translate";

// 오늘 페이지 뉴스 (2026-10-21) — 전부 Google News RSS (키 없음). Yahoo 는 429 로 막혀 안 쓴다.
//  · 오늘 시황: 한국 언론 기사 제목 그대로 (구글 뉴스 한국판 검색 '뉴욕증시 OR 미국증시').
//    한국 언론만으로 TOP 10 을 고르면 시황 기사(10-21 292건 중 133건)와 국내 이야기로 채워져서 시황 한 줄에만 쓴다.
//  · 미국 증시 TOP 10: 구글 뉴스 미국 Business 토픽 상위 기사 — 구글이 고른 순서, 같은 사건을 다룬 다른 매체 수(구글이 최대 5곳까지 준다).
//  · 전세계 TOP 10 (2026-10-29): 구글 뉴스 미국판 World 토픽 상위 기사 그대로 (미국 국내 기사는 따로 U.S. 토픽이라 안 섞인다).
//  · 종목 뉴스: 회사 이름 검색 3일 → 잡음(13F 지분·ETF 편입·시세 페이지·집단소송) 빼고 같은 사건 합쳐 최대 5건.
// 영어 제목에는 lib/translate.ts 의 구글 기계번역을 붙인다 (화면은 원문을 항상 같이).
// 여기 함수는 throw 하지 않는다 (실패 = 빈 목록) — 오늘 페이지에 error.tsx 가 없어서. @/ 경로를 안 써서 Node 로 바로 시험된다.

const RSS_BASE = "https://news.google.com/rss";
const REVALIDATE = 1800; // 30분 — 지난 응답을 먼저 보여 주고 뒤에서 새로 받는다
const TIMEOUT_MS = 5000;
const MAX_PER_TICKER = 5;
const TOP_N = 10; // 미국 증시 · 전세계 각각

export type NewsItem = {
  title: string; // 원문 제목 (끝의 ' - 매체' 뗀 것)
  ko: string | null; // 기계번역 — 한국 언론 기사·EN 화면·번역 실패면 null
  source: string;
  url: string; // Google News 를 거쳐 기사로 가는 주소
  time: string | null; // ISO
  others: number; // 같은 사건을 다룬 다른 매체 수
};

export type MarketNews = {
  wrap: NewsItem | null; // 오늘 시황 한 줄 (KO = 한국 언론, EN = 영어 시황 기사)
  top: NewsItem[]; // 주요 뉴스 최대 10
  at: string | null; // 구글이 TOP 10 목록을 준 시각 (응답 Date 머리글)
};

export type WorldNews = {
  top: NewsItem[]; // 전세계 주요 뉴스 최대 10
  at: string | null;
};

/** 뉴스를 찾을 종목 — 이름은 부르는 쪽이 정해서 넘긴다 (PT-1 = dashboard, 내계좌 = 시트). */
export type NewsTarget = { ticker: string; name: string | null; cad: boolean };

export type TickerNews = {
  ticker: string;
  name: string | null;
  items: NewsItem[]; // 최근 3일, 최대 5
  last: NewsItem | null; // 3일 안에 없을 때만 — 30일 안 마지막 기사
};

// ── RSS ─────────────────────────────────────────────

type RssItem = { title: string; source: string; host: string; url: string; time: string | null; related: string[] };

const BUSINESS_US = `${RSS_BASE}/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en`;
const WORLD_US = `${RSS_BASE}/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en`;
const EDITIONS = { us: "hl=en-US&gl=US&ceid=US:en", ca: "hl=en-CA&gl=CA&ceid=CA:en", kr: "hl=ko&gl=KR&ceid=KR:ko" };

const search = (q: string, ed: keyof typeof EDITIONS) => `${RSS_BASE}/search?q=${encodeURIComponent(q)}&${EDITIONS[ed]}`;

async function fetchRss(url: string): Promise<{ items: RssItem[]; at: string | null }> {
  const where = new URL(url).pathname; // 로그에 검색어(종목 이름)는 남기지 않는다
  try {
    let res = await fetch(url, { next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    let body = res.ok ? await res.text() : "";
    // 200 인데 RSS 가 아니면(동의·차단 안내 페이지) 그게 30분 캐시에 들어가 있다 → 이번만 캐시 없이 다시
    if (res.ok && !body.includes("<rss")) {
      res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
      body = res.ok ? await res.text() : "";
    }
    if (!body.includes("<rss")) {
      console.error(`[news] ${res.status} ${where} — RSS 아님`);
      return { items: [], at: null };
    }
    const date = Date.parse(res.headers.get("date") ?? "");
    return { items: parseRss(body), at: Number.isFinite(date) ? new Date(date).toISOString() : null };
  } catch (err) {
    console.error(`[news] ${where}`, err instanceof Error ? err.message : err);
    return { items: [], at: null };
  }
}

function parseRss(xml: string): RssItem[] {
  const out: RssItem[] = [];
  for (const [, body] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const rawSource = plain(field(body, "source"));
    const source = sourceName(rawSource);
    let title = plain(field(body, "title"));
    if (rawSource && title.endsWith(` - ${rawSource}`)) title = title.slice(0, -(rawSource.length + 3)).trim();
    const url = plain(field(body, "link"));
    const host = hostOf(decode(body.match(/<source[^>]*\burl="([^"]*)"/)?.[1] ?? ""));
    const pub = Date.parse(plain(field(body, "pubDate")));
    // 구글 뉴스 description = 같은 사건 기사 목록 (<li><a>제목</a>&nbsp;&nbsp;<font>매체</font></li>), 엔티티로 싸여 온다
    const related = [...decode(field(body, "description")).matchAll(/<font[^>]*>([\s\S]*?)<\/font>/g)].map((m) =>
      sourceName(plain(m[1])),
    );
    // 링크는 구글 뉴스 주소만 (피드 글자가 그대로 href 가 되니까)
    if (title && url.startsWith("https://news.google.com/")) {
      out.push({ title, source, host, url, time: Number.isFinite(pub) ? new Date(pub).toISOString() : null, related });
    }
  }
  return out;
}

function field(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1") : "";
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? m;
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
  });
}

/** 엔티티를 풀고 태그를 뗀 글자. */
function plain(s: string): string {
  return decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 'Yahoo Finance UK'·'Yahoo! Finance Canada' 같은 지역판은 한 매체로. */
function sourceName(s: string): string {
  return /^yahoo!? finance\b/i.test(s) ? "Yahoo Finance" : s;
}

function toItem(r: RssItem): NewsItem {
  const others = new Set(r.related.filter((s) => s && s !== r.source)).size;
  return { title: r.title, ko: null, source: r.source, url: r.url, time: r.time, others };
}

const newestFirst = (a: { time: string | null }, b: { time: string | null }) =>
  (b.time ? Date.parse(b.time) : 0) - (a.time ? Date.parse(a.time) : 0);

const HANGUL = /[가-힣]/;

/** 영어 제목에 기계번역을 붙인다 (한글 제목은 그대로). 번역이 안 되면 ko 는 null 그대로. */
async function withKo(items: NewsItem[], protect?: Protect): Promise<NewsItem[]> {
  const todo = items.filter((x) => !HANGUL.test(x.title));
  if (!todo.length) return items;
  const ko = await translateKo(todo.map((x) => prepForMt(x.title, protect)));
  if (!ko) return items;
  const byItem = new Map(todo.map((x, i) => [x, ko[i]]));
  return items.map((x) => ({ ...x, ko: byItem.get(x) ?? null }));
}

// ── 시황 · TOP 10 ───────────────────────────────────

// 시황 기사 — TOP 10 에서는 뺀다 (시황 한 줄이 따로 있다)
const WRAP_EN =
  /stock market today|live updates?|\bstocks? (rise|fall|rally|slide|slip|close|open|end|edge|climb|drop|gain)|\bdow (jumps|falls|rises|gains|slides|drops)|s&p 500 (rises|falls|closes|gains|drops)|wall street (closes|ends|opens)/i;
const WRAP_KO = /(뉴욕\s?증시|美\s?증시|미\s?증시|미국\s?증시)[\s\S]*(마감|출발|상승|하락|혼조|반등|강세|약세|급등|급락|보합|↑|↓)/;
const WRAP_KO_SKIP = /전망|프리뷰|특징주|코스피|코스닥|마감체크/; // 내다보기·국내 시장 기사
// 주요 매체 — 매체 이름이 영어로 올 때도 있어('Chosunbiz') 주소로도 본다
const KO_MAJOR = new Set(["연합뉴스", "연합인포맥스", "뉴스1", "뉴시스", "한국경제", "매일경제", "머니투데이", "이데일리", "SBS Biz", "조선비즈", "서울경제", "아시아경제"]);
const KO_MAJOR_HOST =
  /(^|\.)(yna\.co\.kr|einfomax\.co\.kr|news1\.kr|newsis\.com|hankyung\.com|mk\.co\.kr|mt\.co\.kr|edaily\.co\.kr|biz\.sbs\.co\.kr|biz\.chosun\.com|sedaily\.com|asiae\.co\.kr)$/;

// Business 토픽에도 기술·생활 기사가 섞인다 — 금융 매체가 같이 다뤘거나 제목에 금융 낱말이 있는 것만
const FIN_SOURCE =
  /reuters|bloomberg|wsj|wall street journal|cnbc|barron|marketwatch|financial times|yahoo finance|investor's business|benzinga|seeking alpha|fox business|business insider|forbes|axios|motley fool|morningstar|associated press|ap news/i;
const FIN_WORD =
  /\b(stocks?|shares?|markets?|earnings|profits?|revenue|sales|guidance|fed|rates?|inflation|tariffs?|mergers?|deals?|acquisitions?|acquires?|ipo|layoffs?|oil|bonds?|treasur(y|ies)|yields?|dollar|bitcoin|crypto|s&p|nasdaq|dow|wall street|banks?|economy|jobs|cpi|gdp|investors?|ceo)\b/i;

export async function getMarketNews(lang: Lang): Promise<MarketNews> {
  const [biz, wrap] = await Promise.all([fetchRss(BUSINESS_US), lang === "ko" ? koWrap() : null]);
  const picked = biz.items
    .filter((x) => !WRAP_EN.test(x.title))
    .filter((x) => [x.source, ...x.related].some((s) => FIN_SOURCE.test(s)) || FIN_WORD.test(x.title))
    .slice(0, TOP_N)
    .map(toItem);
  const top = lang === "ko" ? await withKo(picked) : picked;
  const enWrap = biz.items.find((x) => WRAP_EN.test(x.title));
  return { wrap: lang === "ko" ? wrap : enWrap ? toItem(enWrap) : null, top, at: biz.at };
}

/** 전세계 주요 뉴스 — World 토픽을 구글이 고른 순서 그대로 (거르지 않는다). */
export async function getWorldNews(lang: Lang): Promise<WorldNews> {
  const world = await fetchRss(WORLD_US);
  const picked = world.items.slice(0, TOP_N).map(toItem);
  return { top: lang === "ko" ? await withKo(picked) : picked, at: world.at };
}

/** 한국 언론 시황 기사 중 가장 최근 것 — 2시간 안에 주요 매체 기사가 있으면 그쪽. 하루 안에 없으면(주말) 사흘. */
async function koWrap(): Promise<NewsItem | null> {
  for (const days of [1, 3]) {
    const { items } = await fetchRss(search(`뉴욕증시 OR 미국증시 when:${days}d`, "kr"));
    const wraps = items.filter((x) => x.time && WRAP_KO.test(x.title) && !WRAP_KO_SKIP.test(x.title)).sort(newestFirst);
    if (!wraps.length) continue;
    const newest = Date.parse(wraps[0].time ?? "");
    const major = (x: RssItem) => KO_MAJOR.has(x.source) || KO_MAJOR_HOST.test(x.host);
    const pick = wraps.find((x) => major(x) && newest - Date.parse(x.time ?? "") <= 2 * 3600_000) ?? wraps[0];
    return { ...toItem(pick), others: 0 };
  }
  return null;
}

// ── 종목 뉴스 ───────────────────────────────────────

// 자동 생성 기사만 내는 매체 (MarketBeat 계열 13F 기사, 독일어 모음 사이트, 자동 밸류에이션 글)
const BLOCK_SOURCE =
  /marketbeat|ad hoc news|ad-hoc-news|stock traders daily|etf daily news|defense world|ticker report|american banking news|lincolnian|wkrb|zolmax|modern readers|cerbat gem|daily political|markets daily|transcript daily|the am reporter|watchlist news|simply wall st|kalkine/i;
const BLOCK_TITLE = new RegExp(
  [
    // 13F: '… Asset Management LLC Purchases New Stake in …', '… Trims Position in …', '… Buys 1,234 Shares of …'
    // (운용사 이름이 앞에 있을 때만 — 'Nvidia takes stake in Intel' 같은 진짜 뉴스는 남긴다)
    String.raw`\b(LLC|L\.L\.C|LP|Management|Advisors?|Advisory|Capital|Partners|Wealth|Investments?|Securities|Asset|Fund|Trust|Bank|Group)\b[^.]{0,60}\b(purchases|acquires|buys|sells|trims|raises|lowers|boosts|cuts|increases|reduces|grows|adds to|initiates|establishes|takes|has|holds)\b[^.]{0,30}\b(stake|position|holdings) in\b`,
    String.raw`\b(buys|sells|acquires|purchases)\s+[\d,.]+\s+shares of\b`,
    String.raw`\b(shares|stake|position) (bought|sold|acquired|purchased) by\b`,
    // ETF 자금 흐름: '24 ETFs Add to …', '… Portfolio (XYZ) Buys $12.3 Million More …'
    String.raw`\bETFs? (add|hold|own|buy)\b`,
    String.raw`\b(buys|sells|adds|trims)\s+\$[\d.,]+\s*(million|billion|thousand|[kmb])?\s+(more|worth)\b`,
    // 시세·예측 페이지, 공시 서식 자동 기사 ('Form 144 EXAMPLE INC For: 21 October')
    String.raw`stock price, news, quote|quote (and|&) history|stock quote\b|\bstock (forecasts?|price predictions?)$|\boptions? chain\b`,
    String.raw`^form [0-9a-z-]+ .*\bfor:`,
    // 로펌 집단소송 광고
    String.raw`class action|investor alert|shareholder alert|\bdeadline\b|investigation on behalf|securities fraud|\b(rosen|pomerantz|levi & korsinsky|bragar|faruqi|kessler topaz|bronstein|glancy|schall|gross law|portnoy|robbins geller|johnson fistel)\b`,
  ].join("|"),
  "i",
);

// 매체 등급 — 같은 사건이면 높은 쪽을 대표로, 목록도 높은 쪽 먼저
const TIER1 =
  /reuters|bloomberg|wsj|wall street journal|cnbc|barron|financial times|associated press|ap news|marketwatch|investor's business|new york times|fox business|cnn|axios|business insider|globe and mail|financial post|bnn/i;
const TIER2 =
  /yahoo finance|seeking alpha|benzinga|investing\.com|motley fool|zacks|tipranks|nasdaq|morningstar|forbes|barchart|thestreet|investopedia|kiplinger|stockstory|business wire|pr newswire|globenewswire|newsfile|accesswire|investing news network|proactive|mining\.com|canadian manufacturing/i;
const tier = (s: string) => (TIER1.test(s) ? 0 : TIER2.test(s) ? 1 : 2);

const STOP = new Set(
  "the a an to of in on for and or as at by with after from its is are be this that stock stocks shares inc corp why what how here new says said will".split(" "),
);

function words(title: string): Set<string> {
  return new Set((title.toLowerCase().match(/[a-z0-9$%.]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)));
}

/** 같은 사건의 다른 기사 — 겹치는 낱말 3개 이상이고 짧은 쪽의 절반 이상. */
function sameEvent(a: Set<string>, b: Set<string>): boolean {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n >= 3 && n / Math.min(a.size, b.size) >= 0.5;
}

/** 'Example, Inc.' → 'Example', 'Example Mining Company' → 'Example Mining' (Holdings·Group 은 남긴다 — 앞 낱말만으론 다른 회사일 수 있다). */
export function cleanName(name: string | null): string | null {
  if (!name) return null;
  let s = name.replace(/\s*\([^)]*\)/g, "").replace(/^the\s+/i, "").trim();
  for (let i = 0; i < 2; i++) {
    s = s.replace(/[,\s]+(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|llc|lp|l\.p|n\.v|s\.a|ag|se|class [a-c])\.?$/i, "").trim();
  }
  return s || null;
}

const LINK_WORDS = new Set(["of", "and", "&", "for", "the", "de"]);

/** 검색에 쓸 이름 — 세 낱말 이상이면 앞 두 낱말 (긴 정식 이름은 기사 제목에 잘 안 나온다). 'Bank of X' 는 세 낱말. */
function searchName(clean: string): string {
  const w = clean.split(/\s+/);
  if (w.length <= 2) return clean;
  return w.slice(0, LINK_WORDS.has(w[1].toLowerCase()) ? 3 : 2).join(" ");
}

/** 제목에서 그 회사를 찾을 낱말 — 첫 낱말이 짧으면('Old Dominion' 의 'old') 두 낱말. */
function keyword(clean: string | null): string | null {
  if (!clean) return null;
  const w = clean.split(/\s+/);
  return (w[0].length >= 4 ? w[0] : w.slice(0, 2).join(" ")).toLowerCase();
}

const baseTicker = (t: string) => t.toUpperCase().split(".")[0];

/** 그 종목 기사만 → 잡음 빼기 → 같은 사건 합치기 → 최근 하루 먼저, 그 안에서 매체 등급·다룬 매체 많은 순·최신순. */
function pickTicker(items: RssItem[], ticker: string, clean: string | null): NewsItem[] {
  const tickerRe = new RegExp(String.raw`\b${baseTicker(ticker).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\b`);
  const key = keyword(clean);
  const kept = items.filter(
    (x) =>
      (tickerRe.test(x.title) || (key !== null && x.title.toLowerCase().includes(key))) &&
      !BLOCK_SOURCE.test(x.source) &&
      !BLOCK_TITLE.test(x.title),
  );
  kept.sort((a, b) => tier(a.source) - tier(b.source) || newestFirst(a, b));
  const groups: { lead: RssItem; words: Set<string>; sources: Set<string> }[] = [];
  for (const x of kept) {
    const w = words(x.title);
    const g = groups.find((g) => g.lead.title === x.title || sameEvent(g.words, w));
    if (g) g.sources.add(x.source);
    else groups.push({ lead: x, words: w, sources: new Set([x.source]) });
  }
  const now = Date.now();
  const fresh = (x: { time: string | null }) => (x.time && now - Date.parse(x.time) <= 24 * 3600_000 ? 0 : 1);
  return groups
    .map((g) => ({ ...toItem(g.lead), others: g.sources.size - 1 }))
    .sort((a, b) => fresh(a) - fresh(b) || tier(a.source) - tier(b.source) || b.others - a.others || newestFirst(a, b));
}

async function tickerNews(target: NewsTarget, lang: Lang): Promise<TickerNews> {
  const clean = cleanName(target.name);
  const base = baseTicker(target.ticker);
  // 이름이 티커처럼 짧은 대문자면 검색이 엉뚱해진다 (다른 제품 이름과 겹침) → 법인 꼬리까지 붙은 전체 이름으로
  const q = !clean
    ? `${base} stock`
    : /^[A-Z0-9&.-]{1,4}$/.test(clean) && target.name
      ? `"${target.name}"`
      : `"${searchName(clean)}"`;
  const ed = target.cad ? "ca" : "us";
  let items = pickTicker((await fetchRss(search(`${q} when:3d`, ed))).items, target.ticker, clean).slice(0, MAX_PER_TICKER);
  let last: NewsItem | null = null;
  if (!items.length) {
    last = pickTicker((await fetchRss(search(`${q} when:30d`, ed))).items, target.ticker, clean).sort(newestFirst)[0] ?? null;
  }
  if (lang === "ko") {
    const key = keyword(clean);
    const protect: Protect = { ticker: base, names: [target.name, clean, key && clean ? clean.slice(0, key.length) : null] };
    const all = await withKo(last ? [...items, last] : items, protect);
    items = all.slice(0, items.length);
    last = last ? all[all.length - 1] : null;
  }
  return { ticker: target.ticker, name: target.name, items, last };
}

/** 종목마다 최근 뉴스 (동시에 받는다). */
export async function getTickerNews(targets: NewsTarget[], lang: Lang): Promise<TickerNews[]> {
  return Promise.all(targets.map((t) => tickerNews(t, lang)));
}
