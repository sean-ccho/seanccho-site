"use client";

/** 누르기 전에 한 번 묻는 제출 버튼 (관리 › 회원 등급 바꾸기 — 관리자는 실제 돈 화면까지 보게 되므로). */
export function ConfirmSubmit({ confirm, className, children }: { confirm: string; className?: string; children: React.ReactNode }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!window.confirm(confirm)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
