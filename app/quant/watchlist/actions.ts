"use server";

import { revalidatePath } from "next/cache";
import { authorized, done, sheetError, type ActionState } from "@/lib/actionUtils";
import { todayToronto } from "@/lib/format";
import { getT } from "@/lib/lang";
import { addWatch, parseWatchInput, removeWatch, updateWatch } from "@/lib/watchlist";

export async function saveWatch(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  if (!(await authorized())) return done(false, t.account.errAuth);
  const parsed = parseWatchInput(form, t, todayToronto());
  if ("error" in parsed) return done(false, parsed.error);
  const row = Number(form.get("row") || 0);
  try {
    if (row > 1) await updateWatch(row, String(form.get("expect") ?? ""), parsed.input);
    else await addWatch(parsed.input);
  } catch (err) {
    return done(false, sheetError(err, t));
  }
  revalidatePath("/quant/watchlist");
  return done(true, t.account.saved);
}

export async function deleteWatch(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getT();
  if (!(await authorized())) return done(false, t.account.errAuth);
  const row = Number(form.get("row") || 0);
  if (row < 2) return done(false, t.account.errChanged);
  try {
    await removeWatch(row, String(form.get("expect") ?? ""));
  } catch (err) {
    return done(false, sheetError(err, t));
  }
  revalidatePath("/quant/watchlist");
  return done(true, t.account.deleted);
}
