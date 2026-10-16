"use server";

import { revalidatePath } from "next/cache";
import { addRow, parseInput, removeRow, sellRow, updateRow } from "@/lib/account";
import { authorized, done, sheetError, type ActionState } from "@/lib/actionUtils";
import { getT } from "@/lib/lang";

export type { ActionState };

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

/** 매도 기록 — 매매일지에 붙이고 내계좌 수량을 줄인다 (다 팔면 줄 삭제). */
export async function sellAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  if (!(await authorized())) return done(false, t.account.errAuth);
  const row = Number(form.get("row") || 0);
  if (row < 2) return done(false, t.account.errChanged);
  try {
    const r = await sellRow(row, String(form.get("expect") ?? ""), form, t);
    if (r.error) return done(false, r.error);
  } catch (err) {
    return done(false, sheetError(err, t));
  }
  revalidatePath("/quant/account");
  revalidatePath("/quant/journal");
  return done(true, t.account.sold);
}
