import { RowChangedError } from "./tab";
import { isAdmin } from "./viewer";
import type { Dict } from "./i18n";

// 서버 액션 공통 (내계좌·매매일지·관심종목). "use server" 파일은 async 함수만 내보낼 수 있어서 여기 둔다.

export type ActionState = { ok: boolean; message: string; at: number } | null;

export const done = (ok: boolean, message: string): ActionState => ({ ok, message, at: Date.now() });

/**
 * 서버 액션은 어느 주소로든 불릴 수 있어서 proxy 와 별도로 여기서도 확인한다 — 구글 로그인 + 관리자 등급
 * (2026-11-20, lib/viewer.ts · 그 전엔 SITE_PASSWORD 브라우저 로그인).
 */
export async function authorized(): Promise<boolean> {
  return isAdmin();
}

export function sheetError(err: unknown, t: Dict): string {
  if (err instanceof RowChangedError) return t.account.errChanged;
  console.error("[sheets]", err);
  return t.account.errSheet(err instanceof Error ? err.message : String(err));
}
