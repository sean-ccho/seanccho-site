"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { addRow, parseInput, removeRow, RowChangedError, updateRow } from "@/lib/account";
import { basicAuthOk } from "@/lib/auth";
import type { Dict } from "@/lib/i18n";
import { getT } from "@/lib/lang";

export type ActionState = { ok: boolean; message: string; at: number } | null;

const done = (ok: boolean, message: string): ActionState => ({ ok, message, at: Date.now() });

/** 서버 액션은 어느 주소로든 불릴 수 있어서 proxy 와 별도로 여기서도 비밀번호를 확인한다. */
async function authorized(): Promise<boolean> {
  return basicAuthOk((await headers()).get("authorization"), process.env.SITE_PASSWORD);
}

function sheetError(err: unknown, t: Dict): string {
  if (err instanceof RowChangedError) return t.account.errChanged;
  console.error("[account]", err);
  return t.account.errSheet(err instanceof Error ? err.message : String(err));
}

/** 추가(row 없음) 또는 수정(row + 원래 티커 expect). */
export async function saveRow(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  if (!(await authorized())) return done(false, t.account.errAuth);
  const parsed = parseInput(form, t);
  if ("error" in parsed) return done(false, parsed.error);
  const row = Number(form.get("row") || 0);
  try {
    if (row > 1) await updateRow(row, String(form.get("expect") ?? ""), parsed.input);
    else await addRow(parsed.input);
  } catch (err) {
    return done(false, sheetError(err, t));
  }
  revalidatePath("/quant/account");
  return done(true, t.account.saved);
}

export async function deleteRowAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  if (!(await authorized())) return done(false, t.account.errAuth);
  const row = Number(form.get("row") || 0);
  if (row < 2) return done(false, t.account.errChanged);
  try {
    await removeRow(row, String(form.get("expect") ?? ""));
  } catch (err) {
    return done(false, sheetError(err, t));
  }
  revalidatePath("/quant/account");
  return done(true, t.account.deleted);
}
