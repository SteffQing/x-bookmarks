import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { BookmarkCard, BookmarkMedia, BookmarkMetrics, BookmarkQuote } from "@/lib/types";

/** Single-row table (id = 1) holding credentials, sync status and site settings. */
export const appState = pgTable("app_state", {
  id: integer("id").primaryKey().default(1),
  /** AES-256-GCM encrypted JSON of `{ authToken, ct0 }`. Never leaves the server. */
  credentials: text("credentials"),
  credentialsUpdatedAt: timestamp("credentials_updated_at", { withTimezone: true }),
  status: text("status", { enum: ["unconfigured", "ok", "expired", "error"] })
    .notNull()
    .default("unconfigured"),
  lastError: text("last_error"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncCount: integer("last_sync_count"),
  syncLockedUntil: timestamp("sync_locked_until", { withTimezone: true }),
  /** GraphQL query id for the Bookmarks operation, discovered from x.com's web bundle. */
  queryId: text("query_id"),
  siteTitle: text("site_title"),
  ownerHandle: text("owner_handle"),
});

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: text("id").primaryKey(),
    /** X's timeline sort index: larger means bookmarked more recently. */
    sortIndex: numeric("sort_index", { precision: 30, scale: 0 }).notNull(),
    authorName: text("author_name").notNull(),
    authorHandle: text("author_handle").notNull(),
    authorAvatar: text("author_avatar"),
    authorVerified: boolean("author_verified").notNull().default(false),
    text: text("text").notNull(),
    kind: text("kind", { enum: ["photo", "video", "link", "text"] }).notNull(),
    media: jsonb("media").$type<BookmarkMedia[]>().notNull().default([]),
    card: jsonb("card").$type<BookmarkCard | null>(),
    quote: jsonb("quote").$type<BookmarkQuote | null>(),
    metrics: jsonb("metrics").$type<BookmarkMetrics>().notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bookmarks_sort_idx").on(t.sortIndex.desc())],
);

export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});
