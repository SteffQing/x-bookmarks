import "server-only";
import { and, eq, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getState, readCredentials, updateState } from "./state";
import {
  XAuthError,
  XQueryError,
  defaultQuery,
  discoverQuery,
  fetchBookmarksPage,
  type QueryInfo,
} from "./x/client";
import type { ParsedBookmark } from "./x/parse";
import type { XCredentials } from "./x/cookies";

const MAX_PAGES = 200;
const PAGE_DELAY_MS = 400;
const LOCK_MINUTES = 6;

export type SyncResult =
  | { ok: true; count: number; added: number; removed: number }
  | { ok: false; error: string; skipped?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Takes a short-lived lock so the cron job and a manual sync can't overlap. */
async function acquireLock() {
  const until = new Date(Date.now() + LOCK_MINUTES * 60_000);
  const rows = await getDb()
    .update(schema.appState)
    .set({ syncLockedUntil: until })
    .where(
      and(
        eq(schema.appState.id, 1),
        or(isNull(schema.appState.syncLockedUntil), lt(schema.appState.syncLockedUntil, new Date())),
      ),
    )
    .returning({ id: schema.appState.id });
  return rows.length > 0;
}

async function crawl(creds: XCredentials, query: QueryInfo) {
  const all = new Map<string, ParsedBookmark>();
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchBookmarksPage(creds, query, cursor);
    // Never treat a malformed response as "you have no bookmarks": that would wipe the archive.
    if (!result.valid) throw new XQueryError("X returned a response without a bookmark timeline.");
    let fresh = 0;
    for (const b of result.bookmarks) {
      if (!all.has(b.id)) {
        all.set(b.id, b);
        fresh++;
      }
    }
    // X keeps returning a bottom cursor on the last page; an empty page means we're done.
    if (!result.nextCursor || result.nextCursor === cursor || fresh === 0) break;
    cursor = result.nextCursor;
    await sleep(PAGE_DELAY_MS);
  }
  return [...all.values()];
}

async function store(items: ParsedBookmark[]) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const ids = items.map((b) => b.id);
    const removed = await tx
      .delete(schema.bookmarks)
      .where(ids.length ? notInArray(schema.bookmarks.id, ids) : sql`true`)
      .returning({ id: schema.bookmarks.id });

    let added = 0;
    const now = new Date();
    for (let i = 0; i < items.length; i += 200) {
      const rows = await tx
        .insert(schema.bookmarks)
        .values(items.slice(i, i + 200).map((b) => ({ ...b, syncedAt: now })))
        .onConflictDoUpdate({
          target: schema.bookmarks.id,
          set: {
            sortIndex: sql`excluded.sort_index`,
            authorName: sql`excluded.author_name`,
            authorHandle: sql`excluded.author_handle`,
            authorAvatar: sql`excluded.author_avatar`,
            authorVerified: sql`excluded.author_verified`,
            text: sql`excluded.text`,
            kind: sql`excluded.kind`,
            media: sql`excluded.media`,
            card: sql`excluded.card`,
            quote: sql`excluded.quote`,
            metrics: sql`excluded.metrics`,
            syncedAt: sql`excluded.synced_at`,
          },
        })
        // xmax = 0 only for freshly inserted rows.
        .returning({ inserted: sql<boolean>`(xmax = 0)` });
      added += rows.filter((r) => r.inserted).length;
    }
    return { added, removed: removed.length };
  });
}

/**
 * Pulls every bookmark from X and replaces the stored copy, so anything un-bookmarked on X
 * disappears. Nothing is deleted unless the full crawl succeeds.
 */
export async function runSync(): Promise<SyncResult> {
  const state = await getState();
  const creds = readCredentials(state);
  if (!state || !creds) return { ok: false, error: "No X cookies saved yet." };
  if (!(await acquireLock())) return { ok: false, error: "A sync is already running.", skipped: true };

  try {
    let query = defaultQuery(state.queryId);
    let items: ParsedBookmark[];
    try {
      items = await crawl(creds, query);
    } catch (err) {
      if (!(err instanceof XQueryError)) throw err;
      // The query id probably rotated. Re-read it from x.com and retry once.
      const discovered = await discoverQuery(creds).catch(() => null);
      if (!discovered) throw err;
      query = discovered;
      items = await crawl(creds, query);
    }

    const { added, removed } = await store(items);
    await updateState({
      status: "ok",
      lastError: null,
      lastSyncAt: new Date(),
      lastSyncCount: items.length,
      queryId: query.queryId,
      syncLockedUntil: null,
    });
    return { ok: true, count: items.length, added, removed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateState({
      status: err instanceof XAuthError ? "expired" : "error",
      lastError: message,
      syncLockedUntil: null,
    });
    return { ok: false, error: message };
  }
}
