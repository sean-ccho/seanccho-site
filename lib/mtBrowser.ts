import { useEffect, useState } from "react";
import { MT_DICT, mtChunks, mtGtx, type MtEndpoint } from "./mtEndpoints";

// 브라우저 기계번역 (2026-11-10) — 서버(Vercel)가 구글에 막혀 번역을 못 한 뉴스 제목(NewsItem.mt)만.
// Vercel 서버 주소는 여러 고객이 같이 써서 구글이 잠깐씩 막지만, 방문자 브라우저 주소는 대개 괜찮다.
// 같은 무료 주소(lib/mtEndpoints.ts — 둘 다 CORS 허용)를 쓰고, 같은 순간에 부른 제목은 한 번에 묶어 보낸다.
// 서버가 번역한 화면이면 아무것도 부르지 않는다.

const ENDPOINTS: MtEndpoint[] = [MT_DICT, mtGtx("translate.googleapis.com")];
const TIMEOUT_MS = 6000;

const memo = new Map<string, Promise<string | null>>(); // 영어 → 번역 (실패는 지워서 다음 화면에서 다시)
let queue: { text: string; done: (ko: string | null) => void }[] = [];

async function send(texts: string[]): Promise<string[] | null> {
  for (const ep of ENDPOINTS) {
    try {
      const out: string[] = [];
      for (const part of mtChunks(texts, ep)) {
        const res = await fetch(ep.url(part), { signal: AbortSignal.timeout(TIMEOUT_MS) });
        const got = res.ok ? ep.parse(await res.json(), part.length) : null;
        if (!got) throw new Error(ep.name);
        out.push(...got);
      }
      return out;
    } catch {
      // 막힘 · 시간 초과 · 모양 다름 → 다음 주소
    }
  }
  return null;
}

async function flush(): Promise<void> {
  const batch = queue;
  queue = [];
  const ko = await send(batch.map((x) => x.text));
  batch.forEach((x, i) => {
    if (!ko) memo.delete(x.text);
    x.done(ko?.[i] ?? null);
  });
}

/** 글 하나를 번역 — 같은 순간에 부른 것은 묶어서 한 번에. 실패면 null. */
export function koInBrowser(text: string): Promise<string | null> {
  let p = memo.get(text);
  if (!p) {
    p = new Promise<string | null>((done) => {
      if (!queue.length) setTimeout(() => void flush(), 0);
      queue.push({ text, done });
    });
    memo.set(text, p);
  }
  return p;
}

type MtFields = { ko: string | null; mt?: string };

/**
 * 서버 번역이 빠진 기사(ko 없음 · mt 있음)를 브라우저가 번역해 채운다 → (기사) => 한국어 제목 | null.
 * 처음 그릴 때는 서버 HTML 과 같고(영어), 번역이 오면 바뀐다.
 */
export function useKoFallback(items: readonly (MtFields | null | undefined)[]): (x: MtFields) => string | null {
  const key = JSON.stringify([...new Set(items.flatMap((x) => (x && !x.ko && x.mt ? [x.mt] : [])))]);
  const [got, setGot] = useState<Record<string, string>>({});
  useEffect(() => {
    const texts: string[] = JSON.parse(key);
    if (!texts.length) return;
    let live = true;
    void Promise.all(texts.map(koInBrowser)).then((ko) => {
      if (!live) return;
      const add: Record<string, string> = {};
      texts.forEach((s, i) => {
        const k = ko[i];
        if (k) add[s] = k;
      });
      if (Object.keys(add).length) setGot((g) => ({ ...g, ...add }));
    });
    return () => {
      live = false;
    };
  }, [key]);
  return (x) => x.ko ?? (x.mt ? (got[x.mt] ?? null) : null);
}
