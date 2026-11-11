import { MT_DICT, mtChunks, mtGtx, type MtEndpoint } from "./mtEndpoints";

// 영어 → 한국어 기계번역 (2026-10-21). 구글 번역의 무료 주소(lib/mtEndpoints.ts) — 공식 API 가 아니라 언제든 막힐 수 있다.
// 못 한 글은 null 이고 화면은 영어 원문을 보여 준다 (뉴스 제목은 방문자 브라우저가 한 번 더 — lib/mtBrowser.ts).
// 계속 막히면 Google Cloud Translation 무료 한도(월 50만 자, 결제 수단 등록 필요)로 바꾸는데, 그때도 이 파일만 고치면 된다.
// 이 파일은 @/ 경로를 안 써서 Node 로 바로 시험된다.
//
// 2026-11-10 — 오늘 탭 뉴스가 가끔 영어로만 나왔다. Vercel 서버 주소는 여러 고객이 같이 써서 구글이 잠깐씩 막거나 늦는데,
// 예전엔 한 번 실패하면 그 서버 인스턴스가 두 주소를 10분 쉬게 해서 그동안 모든 번역(뉴스 · 회사 소개 · ETF 설명)이 영어였다.
// (실제 제목 1,467개를 147묶음으로 보낸 시험에서 응답 모양 때문에 실패한 적은 없다.) 그래서
//  · 한 번 번역한 글은 인스턴스가 기억한다(MEMO) — 목록이 조금 바뀌면 새 제목만 보내고, 막혀도 아는 제목은 한글 그대로.
//  · 쉬게 하는 건 막혔을 때(HTTP 오류 · JSON 아님 · 시간 초과)만, 3분.
//  · 실패 이유를 로그에 남긴다 (글 자체는 안 남긴다 — 종목 뉴스 제목에는 종목 이름이 있다).

const TIMEOUT_MS = 5000;
const REVALIDATE = 86400; // 같은 글 묶음이면 하루 재사용 (주소가 곧 캐시 키)
const COOLDOWN_MS = 3 * 60_000; // 막힌 주소는 3분 쉬게 (막혔을 때 그리는 화면마다 5초씩 기다리지 않게)
const MEMO_MAX = 3000; // 뉴스 제목 · 소개 문장 몇 천 개 = 1MB 안쪽

const ENDPOINTS: MtEndpoint[] = [MT_DICT, mtGtx("translate.google.com")];
const downUntil = new Map<MtEndpoint, number>();
const MEMO = new Map<string, string>(); // 영어 → 한국어 (이 인스턴스가 번역한 것, 오래된 것부터 지운다)

function remember(en: string, ko: string): void {
  MEMO.delete(en);
  MEMO.set(en, ko);
  if (MEMO.size > MEMO_MAX) MEMO.delete(MEMO.keys().next().value as string);
}

type Tried = { ok: string[] } | { fail: string; blocked: boolean };

async function tryEndpoint(ep: MtEndpoint, texts: string[]): Promise<Tried> {
  const out: string[] = [];
  for (const part of mtChunks(texts, ep)) {
    let res: Response;
    try {
      res = await fetch(ep.url(part), { next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      return { fail: err instanceof Error && err.name === "TimeoutError" ? "timeout" : "network", blocked: true };
    }
    if (!res.ok) return { fail: `http ${res.status}`, blocked: true };
    // 200 이라도 차단 안내 HTML 이 올 수 있다 → JSON 이 아니면 막힌 것
    const body: unknown = await res.json().catch(() => undefined);
    if (body === undefined) return { fail: "not json", blocked: true };
    const got = ep.parse(body, part.length);
    if (!got) return { fail: `shape (${part.length})`, blocked: false };
    out.push(...got);
  }
  return { ok: out };
}

/** 여러 글을 번역 — 순서 그대로, 못 한 글은 null. 아는 글(MEMO)은 바로, 모르는 글만 구글에. 절대 throw 하지 않는다. */
export async function translateEach(texts: string[]): Promise<(string | null)[]> {
  const known = texts.map((s) => MEMO.get(s) ?? null);
  const todo = [...new Set(texts.filter((_, i) => known[i] == null))];
  const fresh = new Map<string, string>();
  if (todo.length) {
    const why: string[] = [];
    for (const ep of ENDPOINTS) {
      if ((downUntil.get(ep) ?? 0) > Date.now()) {
        why.push(`${ep.name} 쉬는 중`);
        continue;
      }
      const r = await tryEndpoint(ep, todo);
      if ("ok" in r) {
        todo.forEach((s, i) => {
          fresh.set(s, r.ok[i]);
          remember(s, r.ok[i]);
        });
        break;
      }
      why.push(`${ep.name} ${r.fail}`);
      if (r.blocked) downUntil.set(ep, Date.now() + COOLDOWN_MS);
    }
    if (!fresh.size) console.error(`[translate] ${todo.length}건 번역 실패 — ${why.join(" · ")}`);
  }
  return texts.map((s, i) => known[i] ?? fresh.get(s) ?? null);
}

/** 전부 번역됐을 때만 (문장을 이어 붙이는 회사 소개 · ETF 설명) — 하나라도 못 하면 null. */
export async function translateKo(texts: string[]): Promise<string[] | null> {
  if (!texts.length) return [];
  const out = await translateEach(texts);
  return out.every((s): s is string => s != null) ? out : null;
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
