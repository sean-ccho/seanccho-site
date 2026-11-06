"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/**
 * 점선 밑줄 이름 + 설명 말풍선 (2026-11-05).
 * 브라우저 title 툴팁은 마우스를 1초 넘게 가만히 둬야 뜨고 폰에선 아예 안 떠서 — 마우스는 올리자마자, 폰은 누르면 뜬다
 * (다시 누르거나 바깥을 누르면 닫힘, Esc 도). 말풍선은 화면 밖으로 안 나가게 옆으로 밀고, 아래 자리가 없으면 위로.
 */
export function Hint({ text, as: Tag = "span", className, children }: {
  text: string | null | undefined;
  as?: "span" | "dt" | "h3";
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const wrap = useRef<HTMLElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const lastPointer = useRef("mouse");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ dx: 0, up: false });

  // 열릴 때 말풍선 자리 — 이름 왼쪽 끝에 맞춘 자리에서 좌우 12px 여백 안으로 밀고, 아래가 모자라면 위로
  useLayoutEffect(() => {
    if (!open || !tip.current || !wrap.current) return;
    const w = wrap.current.getBoundingClientRect();
    const { offsetWidth: tw, offsetHeight: th } = tip.current;
    const vw = document.documentElement.clientWidth;
    let dx = 0;
    if (w.left + tw > vw - 12) dx = vw - 12 - (w.left + tw);
    if (w.left + dx < 12) dx = 12 - w.left;
    const up = w.bottom + 6 + th > window.innerHeight - 8 && w.top > th + 16;
    setPos({ dx, up });
  }, [open]);

  // 열려 있는 동안 바깥 누름 · Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!text) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag
      ref={wrap as React.RefObject<never>}
      className={`help${className ? ` ${className}` : ""}`}
      tabIndex={0}
      aria-describedby={id}
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
      onPointerDown={(e) => { lastPointer.current = e.pointerType; }}
      onClick={() => lastPointer.current !== "mouse" && setOpen((o) => !o)}
      onFocus={(e) => e.currentTarget.matches(":focus-visible") && setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((o) => !o);
        }
      }}
    >
      {children}
      <span
        ref={tip}
        id={id}
        role="tooltip"
        className={`hint-tip${pos.up ? " hint-tip--up" : ""}`}
        style={pos.dx ? { transform: `translateX(${pos.dx}px)` } : undefined}
        hidden={!open}
      >
        {text}
      </span>
    </Tag>
  );
}
