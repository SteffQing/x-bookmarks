"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { login, logout, requireAdmin } from "@/lib/auth";
import { BOOKMARKS_TAG } from "@/lib/data";
import { saveCredentials, updateState } from "@/lib/state";
import { runSync } from "@/lib/sync";
import { parseCredentials, type XCredentials } from "@/lib/x/cookies";

export type ActionState = { ok: boolean; message: string } | null;

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  const result = await login(String(form.get("password") ?? ""));
  if (!result.ok) return { ok: false, message: result.error };
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin");
}

function describe(result: Awaited<ReturnType<typeof runSync>>): ActionState {
  if (!result.ok) return { ok: false, message: result.error };
  const changes = [result.added && `${result.added} new`, result.removed && `${result.removed} removed`]
    .filter(Boolean)
    .join(", ");
  return { ok: true, message: `Synced ${result.count} bookmarks${changes ? ` (${changes})` : ""}.` };
}

export async function saveCookiesAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const field = (key: string) => String(form.get(key) ?? "").trim();
  let creds: XCredentials | null;
  if (form.get("mode") === "header") {
    creds = parseCredentials(field("cookies"));
    if (!creds) return { ok: false, message: "Couldn’t find both auth_token and ct0 in what you pasted." };
  } else {
    const valid = /^[A-Za-z0-9%_-]+$/;
    // Forgive pasting `auth_token=…` or a quoted value into the box.
    const value = (key: string, name: string) => field(key).replace(new RegExp(`^${name}\\s*=\\s*`), "").replace(/^["']|["';]$/g, "");
    const [authToken, ct0] = [value("authToken", "auth_token"), value("ct0", "ct0")];
    if (!valid.test(authToken) || !valid.test(ct0)) {
      return { ok: false, message: "Enter both auth_token and ct0 (just the values, no quotes or names)." };
    }
    creds = { authToken, ct0 };
  }
  await saveCredentials(creds);
  const result = await runSync();
  updateTag(BOOKMARKS_TAG);
  refresh();
  const summary = describe(result);
  return summary?.ok
    ? { ok: true, message: `Cookies saved. ${summary.message}` }
    : { ok: false, message: `Cookies saved, but the first sync failed: ${summary?.message}` };
}

export async function syncAction(): Promise<ActionState> {
  await requireAdmin();
  const result = await runSync();
  if (result.ok) updateTag(BOOKMARKS_TAG);
  refresh();
  return describe(result);
}

export async function saveSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const text = (key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max) || null;
  // Accept the bare ID or a whole copied request URL (…/graphql/<ID>/Bookmarks?…).
  const rawQuery = text("queryId", 4000);
  const queryId = rawQuery ? (/graphql\/([\w-]+)\/Bookmarks/.exec(rawQuery)?.[1] ?? rawQuery) : null;
  if (queryId && !/^[\w-]{8,64}$/.test(queryId)) return { ok: false, message: "That query ID doesn’t look right." };
  await updateState({
    siteTitle: text("siteTitle", 60),
    ownerHandle: text("ownerHandle", 30)?.replace(/^@/, "") ?? null,
    queryId,
  });
  updateTag(BOOKMARKS_TAG);
  return { ok: true, message: "Saved." };
}
