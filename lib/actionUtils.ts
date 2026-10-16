import { headers } from "next/headers";
import { RowChangedError } from "./tab";
import { basicAuthOk } from "./auth";
import type { Dict } from "./i18n";

// 서버 액션 공통 (내계좌·매매일지·관심종목). "use server" 파일은 async 함수만 내보낼 수 있어서 여기 둔다.

export type ActionState = { ok: boolean; message: string; at: number } | null;

export const done = (ok: boolean, message: string): ActionState => ({ ok, message, at: Date.now() });

/** 서버 액션은 어느 주소로든 불릴 수 있어서 proxy 와 별도로 여기서도 비밀번호를 확인한다. */
export async function authorized(): Promise<boolean> {
  return basicAuthOk((await headers()).get("authorization"), process.env.SITE_PASSWORD);
}

export function sheetError(err: unknown, t: Dict): string {
  if (err instanceof RowChangedError) return t.account.errChanged;
  console.error("[sheets]", err);
  return t.account.errSheet(err instanceof Error ? err.message : String(err));
}
