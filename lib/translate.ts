// 영어 뉴스 제목 → 한국어 (2026-10-21). 구글 번역의 무료 주소 — 공식 API 가 아니라 언제든 막힐 수 있다.
// 막히거나 응답이 이상하면 null 을 돌려주고, 화면은 영어 원문만 보여 준다.
// 막히면 Google Cloud Translation 무료 한도(월 50만 자, 결제 수단 등록 필요)로 바꾸는데, 그때도 이 파일만 고치면 된다.
// 이 파일은 @/ 경로를 안 써서 Node 로 바로 시험된다.

const TIMEOUT_MS = 5000;
const REVALIDATE = 86400; // 같은 제목 묶음이면 하루 재사용 (주소가 곧 캐시 키)
const MAX_URL = 1800; // 주소가 너무 길면 나눠 보낸다
const COOLDOWN_MS = 10 * 60_000; // 실패한 주소는 10분 쉬게 (막혔을 때 매번 기다리지 않게)

type Endpoint = { url: (texts: string[]) => string; parse: (body: unknown, n: number) => string[] | null };

const ENDPOINTS: Endpoint[] = [
  {
    // 여러 제목을 q= 로 한 번에 → ["번역1", "번역2", …] (한 칸이 [번역, 언어] 로 올 때도 있다)
    url: (texts) =>
      `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=ko&${texts.map((s) => `q=${encodeURIComponent(s)}`).join("&")}`,
    parse: (body, n) => {
      if (!Array.isArray(body) || body.length !== n) return null;
      const out = body.map((x) => (typeof x === "string" ? x : Array.isArray(x) && typeof x[0] === "string" ? x[0] : ""));
      return out.every(Boolean) ? out : null;
    },
  },
  {
    // 줄바꿈으로 이어 보내면 번역도 줄 단위로 온다 — 줄 수가 다르면 버린다
    url: (texts) => `https://translate.google.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(texts.join("\n"))}`,
    parse: (body, n) => {
      const segs = Array.isArray(body) && Array.isArray(body[0]) ? (body[0] as unknown[]) : null;
      if (!segs) return null;
      const lines = segs
        .map((s) => (Array.isArray(s) && typeof s[0] === "string" ? s[0] : ""))
        .join("")
        .split("\n")
        .map((s) => s.trim());
      return lines.length === n && lines.every(Boolean) ? lines : null;
    },
  },
];

const downUntil = new Map<Endpoint, number>();

/** 주소 길이가 넘지 않게 제목을 나눈다 (한 묶음에 최소 한 개). */
function chunks(texts: string[], ep: Endpoint): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  for (const s of texts) {
    if (cur.length && ep.url([...cur, s]).length > MAX_URL) {
      out.push(cur);
      cur = [];
    }
    cur.push(s);
  }
  if (cur.length) out.push(cur);
  return out;
}

async function tryEndpoint(ep: Endpoint, texts: string[]): Promise<string[] | null> {
  const out: string[] = [];
  for (const part of chunks(texts, ep)) {
    const res = await fetch(ep.url(part), { next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    // 200 이라도 차단 안내 HTML 이 올 수 있다 → JSON 이 아니면 실패
    const got = ep.parse(await res.json().catch(() => null), part.length);
    if (!got) return null;
    out.push(...got);
  }
  return out;
}

/** 여러 제목을 번역 — 순서 그대로. 두 주소 다 안 되면 null (화면은 원문만). 절대 throw 하지 않는다. */
export async function translateKo(texts: string[]): Promise<string[] | null> {
  if (!texts.length) return [];
  for (const ep of ENDPOINTS) {
    if ((downUntil.get(ep) ?? 0) > Date.now()) continue;
    try {
      const out = await tryEndpoint(ep, texts);
      if (out) return out;
    } catch {
      // 시간 초과·네트워크 — 아래에서 쉬게 하고 다음 주소로
    }
    downUntil.set(ep, Date.now() + COOLDOWN_MS);
  }
  console.error(`[translate] 번역 실패 (${texts.length}건) — 원문만 보여 준다`);
  return null;
}

/** 종목 뉴스 번역 때 지킬 이름 — 회사 이름을 티커로 바꿔, 보통 낱말이기도 한 회사 이름을 번역기가 낱말로 옮기지 못하게. */
export type Protect = { ticker: string; names: (string | null)[] };

// 영어 낱말이기도 한 티커 — 이름을 이걸로 바꾸면 문장이 깨진다 ('ALL' → 'all'). 이런 종목은 회사 이름을 그대로 둔다.
const WORD_TICKERS = new Set([
  "NOW", "ALL", "ARE", "CAN", "ONE", "HAS", "FOR", "OUT", "SEE", "ANY", "NEW", "OLD", "BIG", "LOW", "FAST", "TRUE",
  "WELL", "OPEN", "GOOD", "REAL", "NICE", "PLAY", "RUN", "EAT", "LOVE", "SAFE", "LIFE", "MOST", "JUST", "HOPE",
]);

// 제목 대문자 낱말 중 고유명사가 아닌 금융 낱말 — 대문자로 두면 번역기가 다른 뜻으로 옮긴다 (Guidance → '지침')
const FINANCE_WORDS =
  /\b(Guidance|Outlook|Forecasts?|Earnings|Revenue|Sales|Profits?|Shares|Stocks?|Dividends?|Buybacks?|Upgrades?|Downgrades?|Price Targets?|Estimates|Results|Quarter|Ratings?|Analysts?|Rally|Rallies)\b/g;

// 번역기가 뜻을 뒤집거나 엉뚱하게 옮기는 금융 동사 (10-21 실측: Tumbles → '실패', Rallies → '집회', Earnings Beat → '실적 부진')
const GLOSSARY: [RegExp, string][] = [
  [/\bearnings beats?\b/gi, "better-than-expected earnings"],
  [/\b(tumbles?|tumbled|plunges?|plunged|plummets?|plummeted|sinks|sank|craters?|cratered|tanked)\b/gi, "drops sharply"],
  [/\b(soars?|soared|surges?|surged|skyrockets?|skyrocketed|pops|popped|spikes|spiked|zooms?|zoomed|rockets|rocketed)\b/gi, "rises sharply"],
  [/\b(climbs?|climbed|rall(?:y|ies|ied))\b/gi, "rises"],
  [/\b(slips?|slipped|slides?|slid|dips|dipped)\b/gi, "edges lower"],
  [/\bmiss(?:es|ed)?\b(?=[^.]{0,40}\b(?:estimates?|expectations?|forecasts?|views?|targets?)\b)/gi, "falls short of"],
  [/\bbeats?\b(?=[^.]{0,40}\b(?:estimates?|expectations?|forecasts?|views?)\b)/gi, "exceeds"],
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 번역기에 넣기 전 제목 손질: (종목 뉴스면) 회사 이름 → 티커, 거래소 꼬리 떼기, 금융 낱말 소문자, 뜻이 뒤집히는 동사 바꾸기. */
export function prepForMt(title: string, protect?: Protect): string {
  let s = title;
  if (protect) {
    const tk = protect.ticker;
    if (tk.length >= 3 && !WORD_TICKERS.has(tk)) {
      const names = [...new Set(protect.names.filter((n): n is string => Boolean(n && n.length >= 3)))];
      for (const n of names.sort((a, b) => b.length - a.length)) {
        // 'Example Holdings, Inc.' 처럼 글자 아닌 것으로 끝나면 끝의 \b 를 빼야 맞는다
        const edge = (c: string) => (/\w/.test(c) ? String.raw`\b` : "");
        s = s.replace(new RegExp(`${edge(n[0])}${esc(n)}${edge(n.at(-1) ?? "")}`, "gi"), tk);
      }
    }
    s = s
      .replace(/\s*\((?:NYSE|NASDAQ|Nasdaq|NYSE ?American|AMEX|TSX|TSXV|TSX-V|CSE|OTC|OTCQB|OTCQX|CBOE)\s*:\s*[A-Z][A-Z.-]*\)/g, "")
      .replace(new RegExp(String.raw`\s*\(\$?${esc(tk)}\)`, "g"), "");
  }
  s = s.replace(FINANCE_WORDS, (w: string, _m: string, at: number) => (at === 0 ? w : w.toLowerCase()));
  for (const [re, to] of GLOSSARY) s = s.replace(re, to);
  return s;
}
