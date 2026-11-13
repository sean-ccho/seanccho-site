"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fileLevel, fileReason, rowLevel, rowText, worstLevel, type DsFile, type DsLevel } from "@/lib/dataStatus";
import { useT } from "./LangProvider";

/**
 * 자료 상태 표시 (2026-11-13) — 날짜 옆 작은 버튼: 정상(초록) · 일부만(노랑) · 실패(빨강). 누르면 그 자리에서 카드가 펼쳐져
 * 칸마다 '몇 개 중 몇 개를 받았나'를 보여 준다.
 * - page: 그 화면이 쓰는 파일 1~2개 — 칸 표를 바로
 * - global: 맨 위 공통 머리 — 파일 목록 (가장 나쁜 상태로 버튼 색), 파일마다 펼쳐서 칸 표
 * 파일이 하나도 없으면(점검 자료가 아직 없음) 아무것도 그리지 않는다.
 */
export function DataStatusChip({ files, variant = "page", note }: {
  files: DsFile[];
  variant?: "page" | "global";
  /** 카드 맨 밑 한 줄 (예: 스냅샷으로 대신 보여 주는 중) */
  note?: string;
}) {
  const { t } = useT();
  const D = t.dataStatus;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!files.length) return null;
  const levels = files.map(fileLevel);
  const level = worstLevel(levels);
  const bad = levels.filter((l) => l === level).length;
  const first = files[levels.indexOf(level)];
  // 버튼 글 — 넓은 화면은 이유까지, 폰은 한 단어 (CSS 가 ds-chip__why 를 숨긴다)
  const word = variant === "global"
    ? (level === "green" ? D.allOk : D.someBad(D.level[level], bad))
    : D.level[level];
  const why = level === "green" ? "" : variant === "global" ? "" : fileReason(first);

  return (
    <span className={`ds-wrap ds-wrap--${variant}`} ref={wrap}>
      <button type="button" className="ds-chip" data-level={level} aria-expanded={open} aria-controls={popId}
        title={D.chipTitle} onClick={() => setOpen((v) => !v)}>
        <span className="ds-dot" aria-hidden="true" />
        <span className="ds-chip__word">{word}</span>
        {why && <span className="ds-chip__why">· {why}</span>}
      </button>
      {open && (
        <div className="ds-pop" id={popId} role="dialog" aria-label={D.popTitle}>
          <p className="ds-pop__title">{D.popTitle}</p>
          {variant === "global" ? (
            <ul className="ds-files">
              {files.map((f, i) => (
                <li key={`${f.label}-${i}`}>
                  <details>
                    <summary>
                      <LevelMark level={levels[i]} word={D.level[levels[i]]} />
                      <span className="ds-files__label">{f.label}</span>
                      {levels[i] !== "green" && <span className="ds-files__why">{fileReason(f)}</span>}
                    </summary>
                    <RowsTable f={f} />
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            files.map((f, i) => (
              <div key={`${f.label}-${i}`} className="ds-file">
                {files.length > 1 && (
                  <p className="ds-file__head">
                    <LevelMark level={levels[i]} word={D.level[levels[i]]} />
                    <span>{f.label}</span>
                  </p>
                )}
                <RowsTable f={f} />
              </div>
            ))
          )}
          {note && <p className="ds-pop__note ds-pop__note--warn">{note}</p>}
          <p className="ds-pop__note">{D.rule}</p>
        </div>
      )}
    </span>
  );
}

function LevelMark({ level, word }: { level: DsLevel; word: string }) {
  return (
    <span className="ds-mark" data-level={level}>
      <span className="ds-dot" aria-hidden="true" />
      {word}
    </span>
  );
}

/** 칸 표 — 항목 · 받음 · 판정. 파일이 없거나 이번 밤 것이 아니면 그 한 줄. */
function RowsTable({ f }: { f: DsFile }) {
  const { t } = useT();
  const D = t.dataStatus;
  if (f.missing) return <p className="ds-empty" data-level="red">{D.missing}</p>;
  return (
    <>
      {f.stale && <p className="ds-empty" data-level="red">{D.stale}</p>}
      <table className="ds-table">
        <thead>
          <tr>
            <th scope="col">{D.colItem}</th>
            <th scope="col" className="num">{D.colGot}</th>
            <th scope="col">{D.colLevel}</th>
          </tr>
        </thead>
        <tbody>
          {f.rows.map((r) => {
            const lv = rowLevel(r);
            const got = rowText(r).slice(r.label.length + 1);
            return (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                <td className="num">{got}</td>
                <td><span className="ds-mark" data-level={lv}>{D.level[lv]}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
