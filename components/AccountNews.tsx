"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "./LangProvider";
import { TickerNewsList } from "./NewsList";
import type { TickerNews } from "@/lib/news";

// 오늘 페이지의 '내계좌 보유종목 뉴스' 칸. 내계좌는 비밀번호 뒤라 서버가 오늘 페이지에 그려 넣지 않는다 (오늘 페이지는 공개).
// 브라우저가 /quant/account/news 를 부르면, 내계좌를 한 번 열어 로그인한 브라우저는 /quant/ 아래로 비밀번호를 같이 보낸다.
// 뒤에서 하는 요청이라 401 이어도 로그인 창은 안 뜬다 (proxy.ts) — 대신 '내계좌 열기'·'다시 확인'을 보여 준다 (매수 팝업과 같은 방식).

type State =
  | { kind: "loading" }
  | { kind: "locked" } // 401 — 이 브라우저에 비밀번호가 없음
  | { kind: "off" } // 503 — 서버에 비밀번호·시트 설정이 없음
  | { kind: "error" }
  | { kind: "ok"; list: TickerNews[]; now: number };

export function AccountNews() {
  const { lang, t } = useT();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [round, setRound] = useState(0); // '다시 확인' · 창으로 돌아오면 다시

  useEffect(() => {
    let alive = true;
    fetch("/quant/account/news", { credentials: "same-origin", cache: "no-store" })
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 401) return setState({ kind: "locked" });
        if (res.status === 503) return setState({ kind: "off" });
        const body = (await res.json().catch(() => null)) as { ok?: boolean; tickers?: TickerNews[] } | null;
        if (!alive) return;
        setState(res.ok && body?.ok && body.tickers ? { kind: "ok", list: body.tickers, now: Date.now() } : { kind: "error" });
      })
      .catch(() => alive && setState({ kind: "error" }));
    return () => {
      alive = false;
    };
  }, [lang, round]); // 언어를 바꾸면 router.refresh 만 돌고 이 칸의 상태는 남아서 — 다시 부른다

  const recheck = useCallback(() => {
    setState({ kind: "loading" });
    setRound((n) => n + 1);
  }, []);

  // 다른 탭에서 내계좌에 로그인하고 돌아오면 저절로 다시 확인
  const locked = state.kind === "locked";
  useEffect(() => {
    if (!locked) return;
    window.addEventListener("focus", recheck);
    return () => window.removeEventListener("focus", recheck);
  }, [locked, recheck]);

  return (
    <section className="card" aria-labelledby="news-account-title" aria-busy={state.kind === "loading"}>
      <h2 id="news-account-title" className="news-card-title">
        {t.news.account} <span aria-hidden="true">🔒</span>
      </h2>
      {state.kind === "loading" && <p className="news-none">{t.news.loading}</p>}
      {state.kind === "locked" && (
        <div className="news-lock">
          <p className="news-none">{t.news.locked}</p>
          <span className="news-lock__btns">
            <a className="btn btn--small" href="/quant/account" target="_blank" rel="noopener">
              {t.buy.openAccount}
            </a>
            <button type="button" className="btn btn--small" onClick={recheck}>
              {t.buy.recheck}
            </button>
          </span>
        </div>
      )}
      {state.kind === "off" && <p className="news-none">{t.news.unavailable}</p>}
      {state.kind === "error" && (
        <div className="news-lock">
          <p className="news-none">{t.news.failed}</p>
          <span className="news-lock__btns">
            <button type="button" className="btn btn--small" onClick={recheck}>
              {t.buy.recheck}
            </button>
          </span>
        </div>
      )}
      {state.kind === "ok" &&
        (state.list.length > 0 ? (
          <TickerNewsList list={state.list} t={t} now={state.now} />
        ) : (
          <p className="news-none">{t.news.noHoldings}</p>
        ))}
    </section>
  );
}
