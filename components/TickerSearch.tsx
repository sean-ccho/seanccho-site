"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { useT } from "./LangProvider";

/** [티커, 회사 이름, 시장 — sp500 · nasdaq · new · ca · extra · etf] (app/api/tickers). */
type Row = [string, string, string];

const RECENT_KEY = "search:recent";
const RECENT_MAX = 6;
const SHOWN = 20;
/** 받아 둔 목록을 쓰는 시간 — 탭을 오래 열어 두면 밤사이 새 시장 · 종목이 안 보였다 (2026-11-05 캐나다 탭). */
const FRESH_MS = 30 * 60_000;

// 목록은 열 때 받고 30분 동안 다시 쓴다 (실패하면 다음에 다시)
let cache: { at: number; rows: Promise<Row[]> } | null = null;
function loadRows(): Promise<Row[]> {
  if (cache && Date.now() - cache.at < FRESH_MS) return cache.rows;
  const entry = {
    at: Date.now(),
    rows: fetch("/api/tickers")
      .then((r) => {
        if (!r.ok) throw new Error(`tickers ${r.status}`);
        return r.json() as Promise<Row[]>;
      })
      .catch((err) => {
        if (cache === entry) cache = null;
        throw err;
      }),
  };
  cache = entry;
  return entry.rows;
}

/** 캐나다 상장의 거래소 심볼 (BBD-B.TO → BBD.B, RY.TO → RY, NBM.V → NBM). 캐나다 상장이 아니면 null. */
const CA_SUFFIX = /\.(TO|V|CN|NE)$/;
const localSymbol = (t: string): string | null => (CA_SUFFIX.test(t) ? t.replace(CA_SUFFIX, "").replace(/-/g, ".") : null);

/** 종목은 종목 상세, ETF 는 ETF 탭의 그 줄로. */
const hrefOf = (r: Row) => (r[2] === "etf" ? `/quant/etf#etf-${r[0]}` : `/quant/stock/${encodeURIComponent(r[0])}`);

/** 시장 순서 — 같은 글자로 시작하면 S&P 500 → ETF → 나스닥·NYSE → 신규 상장 → 번외 → 캐나다 (NV → NVDA 가 NVA 보다 먼저). */
const MARKET_ORDER: Record<string, number> = { sp500: 0, etf: 1, nasdaq: 2, new: 3, extra: 4, ca: 5 };
const byMarket = (a: Row, b: Row) => (MARKET_ORDER[a[2]] ?? 9) - (MARKET_ORDER[b[2]] ?? 9);

/**
 * 티커가 똑같은 것 → 캐나다 상장 중 거래소 심볼이 똑같은 것 (RY → RY.TO, BBD.B → BBD-B.TO) → 티커 · 거래소 심볼이 그 글자로
 * 시작하는 것(시장 순 · 짧은 순) → 회사 이름에 들어간 것 (두 글자부터, 시장 순). 캐나다가 시장 순 끝이라 전에는 CM · T 처럼
 * 짧은 심볼은 미국 종목 20개에 밀려 안 보였다.
 */
function rank(rows: Row[], q: string): Row[] {
  const Q = q.trim().toUpperCase();
  if (!Q) return [];
  const D = Q.replace(/\./g, "-"); // 미국 종류주를 점으로 쳐도 (BRK.B → BRK-B)
  const exact: Row[] = [];
  const same: Row[] = [];
  const prefix: Row[] = [];
  const name: Row[] = [];
  for (const r of rows) {
    const local = localSymbol(r[0]);
    if (r[0] === Q || r[0] === D) exact.push(r);
    else if (local === Q) same.push(r);
    else if (r[0].startsWith(Q) || r[0].startsWith(D) || local?.startsWith(Q)) prefix.push(r);
    else if (Q.length >= 2 && r[1].toUpperCase().includes(Q)) name.push(r);
  }
  same.sort((a, b) => a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1));
  prefix.sort((a, b) => byMarket(a, b) || a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1));
  name.sort(byMarket);
  return [...exact, ...same, ...prefix, ...name].slice(0, SHOWN);
}

function readRecent(): Row[] {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? (v.filter((x) => Array.isArray(x) && x.length === 3) as Row[]) : [];
  } catch {
    return [];
  }
}

/**
 * 머리의 '종목 찾기' (2026-11-02) — 누르거나 ⌘K/Ctrl+K 로 열고, 티커·회사 이름으로 전체분석 · ETF 모든 종목을 찾아 바로 연다.
 * 전에는 목록 안 거르기뿐이라 목록에 없는 종목의 상세로 갈 길이 없었다. 창은 <dialog> (Esc · 바깥 누르기로 닫힘, 포커스는 창 안).
 */
export function TickerSearch() {
  const { t } = useT();
  const S = t.search;
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [act, setAct] = useState(0);
  const [recent, setRecent] = useState<Row[]>([]);
  const [mac, setMac] = useState(true);
  const listId = useId();

  const open = () => {
    const d = dlg.current;
    if (!d || d.open) return;
    setQ("");
    setAct(0);
    setRecent(readRecent());
    setFailed(false);
    d.showModal();
    input.current?.focus();
    loadRows().then(setRows, () => setFailed(true));
  };

  // ⌘K / Ctrl+K 로 열고 닫기
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      if (dlg.current?.open) dlg.current.close();
      else open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // open 은 ref 와 setState 만 써서 처음 것 그대로 써도 된다

  const results = useMemo(() => (rows ? rank(rows, q) : []), [rows, q]);
  const typing = q.trim().length > 0;
  const shown = typing ? results : recent;

  const go = (r: Row) => {
    try {
      const next = [r, ...readRecent().filter((x) => x[0] !== r[0])].slice(0, RECENT_MAX);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // 기억만 못 할 뿐
    }
    dlg.current?.close();
    router.push(hrefOf(r));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!shown.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAct((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = shown[Math.min(act, shown.length - 1)];
      if (r) go(r);
    }
  };

  const status = !typing
    ? null
    : failed
      ? S.failed
      : !rows
        ? S.loading
        : results.length === 0
          ? S.empty
          : null;

  return (
    <>
      <button type="button" className="q-search-btn" onClick={open} aria-haspopup="dialog" aria-label={`${S.open} (${mac ? "⌘K" : "Ctrl+K"})`}>
        <Icon name="search" size={16} />
        <span className="q-search-btn__label">{S.open}</span>
        <kbd className="q-search-btn__key">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      <dialog ref={dlg} className="search-dialog" aria-label={S.title}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close(); // 바깥(뒤 어두운 곳) 누르면 닫기
        }}>
        <div className="search-dialog__box">
          <div className="search-dialog__bar">
            <Icon name="search" size={18} />
            <input ref={input} className="search-dialog__input" type="search" value={q} placeholder={S.placeholder}
              autoCapitalize="characters" autoComplete="off" spellCheck={false}
              role="combobox" aria-expanded={shown.length > 0} aria-controls={listId} aria-autocomplete="list"
              aria-activedescendant={shown.length ? `${listId}-${Math.min(act, shown.length - 1)}` : undefined}
              onChange={(e) => {
                setQ(e.target.value);
                setAct(0);
              }}
              onKeyDown={onKeyDown} />
            <button type="button" className="search-dialog__close" aria-label={S.close} onClick={() => dlg.current?.close()}>
              <span aria-hidden="true">Esc</span>
            </button>
          </div>
          {!typing && recent.length > 0 && <p className="search-dialog__cap">{S.recent}</p>}
          <ul id={listId} role="listbox" className="search-dialog__list" aria-label={S.title}>
            {shown.map((r, i) => (
              <li key={r[0]} id={`${listId}-${i}`} role="option" aria-selected={i === Math.min(act, shown.length - 1)}
                onMouseEnter={() => setAct(i)} onClick={() => go(r)}>
                <span className="tick">{r[0]}</span>
                <span className="search-dialog__name">{r[1]}</span>
                <span className="search-dialog__mkt">{S.markets[r[2]] ?? r[2]}</span>
              </li>
            ))}
          </ul>
          {status && <p className="search-dialog__status" role="status">{status}</p>}
          <p className="search-dialog__hint">{S.hint}</p>
        </div>
      </dialog>
    </>
  );
}
