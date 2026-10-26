import "server-only";
import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb, hasDatabase, schema } from "@/db";
import { getState } from "./state";
import type { Bookmark, BookmarkPage, KindFilter } from "./types";

export const BOOKMARKS_TAG = "bookmarks";
export const PAGE_SIZE = 30;

export interface SiteInfo {
  /** True once credentials have been saved or bookmarks exist. */
  configured: boolean;
  title: string;
  handle: string | null;
  total: number;
  lastSyncAt: string | null;
}

const DEFAULT_TITLE = "Bookmarks";

type Row = typeof schema.bookmarks.$inferSelect;

function toBookmark(row: Row): Bookmark {
  return {
    id: row.id,
    authorName: row.authorName,
    authorHandle: row.authorHandle,
    authorAvatar: row.authorAvatar,
    authorVerified: row.authorVerified,
    text: row.text,
    kind: row.kind,
    media: row.media,
    card: row.card ?? null,
    quote: row.quote ?? null,
    metrics: row.metrics,
    postedAt: row.postedAt.toISOString(),
  };
}

function filters(q: string, kind: KindFilter): SQL | undefined {
  const b = schema.bookmarks;
  const conditions: SQL[] = [];
  if (kind !== "all") conditions.push(eq(b.kind, kind));
  const term = q.trim();
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const handle = term.replace(/^@/, "");
    conditions.push(
      or(
        ilike(b.text, pattern),
        ilike(b.authorName, pattern),
        ilike(b.authorHandle, `%${handle.replace(/[\\%_]/g, (c) => `\\${c}`)}%`),
        sql`${b.quote}->>'text' ilike ${pattern}`,
        sql`${b.card}->>'title' ilike ${pattern}`,
      )!,
    );
  }
  return conditions.length ? and(...conditions) : undefined;
}

export async function queryBookmarks(opts: {
  offset?: number;
  limit?: number;
  q?: string;
  kind?: KindFilter;
}): Promise<BookmarkPage> {
  const { offset = 0, limit = PAGE_SIZE, q = "", kind = "all" } = opts;
  if (!hasDatabase()) return { items: [], next: null, total: 0 };
  const db = getDb();
  const where = filters(q, kind);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(schema.bookmarks)
      .where(where)
      .orderBy(desc(schema.bookmarks.sortIndex), desc(schema.bookmarks.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(schema.bookmarks).where(where),
  ]);
  const next = offset + rows.length < total ? offset + rows.length : null;
  return { items: rows.map(toBookmark), next, total };
}

/** Site header info plus the first page. Cached until the next sync invalidates it. */
export async function getHomeData(): Promise<{ site: SiteInfo; page: BookmarkPage }> {
  "use cache";
  cacheTag(BOOKMARKS_TAG);
  cacheLife("days");

  if (!hasDatabase()) {
    return {
      site: { configured: false, title: DEFAULT_TITLE, handle: null, total: 0, lastSyncAt: null },
      page: { items: [], next: null, total: 0 },
    };
  }
  const [state, page] = await Promise.all([getState(), queryBookmarks({})]);
  return {
    site: {
      configured: Boolean(state?.credentials) || page.total > 0,
      title: state?.siteTitle || DEFAULT_TITLE,
      handle: state?.ownerHandle || null,
      total: page.total,
      lastSyncAt: state?.lastSyncAt?.toISOString() ?? null,
    },
    page,
  };
}

export async function getBookmark(id: string): Promise<Bookmark | null> {
  "use cache";
  cacheTag(BOOKMARKS_TAG);
  cacheLife("days");

  if (!hasDatabase() || !/^\d+$/.test(id)) return null;
  const [row] = await getDb().select().from(schema.bookmarks).where(eq(schema.bookmarks.id, id));
  return row ? toBookmark(row) : null;
}
