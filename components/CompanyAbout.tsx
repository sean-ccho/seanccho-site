"use client";

import { useEffect, useState } from "react";
import { useT } from "./LangProvider";
import type { About } from "@/lib/about";

const LONG = 320; // 이보다 길면 처음엔 몇 줄만 보이고 '더 보기'

/** 회사 이름 옆 '회사 소개' 버튼 — 펼침 상자(AboutPanel)는 부르는 쪽이 둔다. */
export function AboutButton({ open, onToggle, controls }: { open: boolean; onToggle: () => void; controls: string }) {
  const { t } = useT();
  return (
    <button type="button" className="about-btn" aria-expanded={open} aria-controls={controls} title={t.about.help}
      onClick={onToggle}>
      {t.about.button} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
    </button>
  );
}

/** 소개 글 — 한국어(기계번역)를 먼저, 영어 원문은 접어서. 번역이 없으면 원문만. */
export function AboutText({ about }: { about: About }) {
  const { lang, t } = useT();
  const [more, setMore] = useState(false);
  const text = about.ko ?? about.en;
  const long = text.length > LONG;
  return (
    <>
      <p className={`about__text${long && !more ? " about__text--clamp" : ""}`}>{text}</p>
      <div className="about__foot tiny muted">
        {long && (
          <button type="button" className="about__more" onClick={() => setMore((v) => !v)}>
            {more ? t.about.less : t.about.more}
          </button>
        )}
        {lang === "ko" && <span>{about.ko ? t.about.mt : t.about.mtFail}</span>}
        <span>{t.about.source}</span>
      </div>
      {about.ko && (
        <details className="about__orig">
          <summary className="tiny muted">{t.about.original}</summary>
          <p lang="en">{about.en}</p>
        </details>
      )}
    </>
  );
}

type Got = About | "none" | "error";
const cache = new Map<string, Got>(); // 같은 종목을 다시 열면 다시 받지 않는다 (화면 이동 전까지)

/** 누르면 그 종목 소개를 받아 보여 주는 상자. */
export function AboutPanel({ ticker, id }: { ticker: string; id: string }) {
  const { lang, t } = useT();
  const key = `${lang}:${ticker}`;
  const [got, setGot] = useState<{ key: string; v: Got } | null>(null);
  const cached = cache.get(key);

  useEffect(() => {
    if (cache.has(key)) return;
    const ctl = new AbortController();
    fetch(`/api/about/${encodeURIComponent(ticker)}?lang=${lang}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { en: string | null; ko: string | null }) => {
        const v: Got = j.en ? { en: j.en, ko: j.ko } : "none";
        cache.set(key, v);
        setGot({ key, v });
      })
      .catch(() => {
        if (!ctl.signal.aborted) setGot({ key, v: "error" }); // 실패는 저장하지 않는다 — 다시 열면 다시 받는다
      });
    return () => ctl.abort();
  }, [key, ticker, lang]);

  const v = cached ?? (got?.key === key ? got.v : null);
  return (
    <div className="about" id={id}>
      {v == null && <p className="small muted about__status">{t.about.loading}</p>}
      {v === "none" && <p className="small muted about__status">{t.about.none}</p>}
      {v === "error" && <p className="small muted about__status">{t.about.error}</p>}
      {v != null && typeof v === "object" && <AboutText about={v} />}
    </div>
  );
}
