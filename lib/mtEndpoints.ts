// 구글 번역 무료 주소 (2026-10-21, 2026-11-10 lib/translate.ts 에서 떼어 냄) — 서버(lib/translate.ts)와
// 브라우저(lib/mtBrowser.ts)가 같이 쓴다. 공식 API 가 아니라 언제든 막힐 수 있다 → 응답 모양이 다르면 parse 가 null.
// 이 파일은 @/ 경로를 안 써서 Node 로 바로 시험된다.

export type MtEndpoint = {
  name: string; // 로그용
  url: (texts: string[]) => string;
  parse: (body: unknown, n: number) => string[] | null;
};

const MAX_URL = 1800; // 주소가 너무 길면 나눠 보낸다

/** 여러 글을 q= 로 한 번에 → ["번역1", "번역2", …] (한 칸이 [번역, 언어] 로 올 때도 있다). 브라우저에서도 된다 (CORS *). */
export const MT_DICT: MtEndpoint = {
  name: "dict",
  url: (texts) =>
    `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=ko&${texts.map((s) => `q=${encodeURIComponent(s)}`).join("&")}`,
  parse: (body, n) => {
    if (!Array.isArray(body) || body.length !== n) return null;
    const out = body.map((x) => (typeof x === "string" ? x : Array.isArray(x) && typeof x[0] === "string" ? x[0] : ""));
    return out.every(Boolean) ? out : null;
  },
};

/**
 * 줄바꿈으로 이어 보내면 번역도 줄 단위로 온다 — 줄 수가 다르면 버린다.
 * translate.google.com 은 서버에서만 (CORS 머리글이 없다), 브라우저는 translate.googleapis.com.
 */
export function mtGtx(host: "translate.google.com" | "translate.googleapis.com"): MtEndpoint {
  return {
    name: `gtx@${host}`,
    url: (texts) => `https://${host}/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(texts.join("\n"))}`,
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
  };
}

/** 주소 길이가 넘지 않게 글을 나눈다 (한 묶음에 최소 한 개). */
export function mtChunks(texts: string[], ep: MtEndpoint): string[][] {
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
