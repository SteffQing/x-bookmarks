CREATE TABLE "app_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"credentials" text,
	"credentials_updated_at" timestamp with time zone,
	"status" text DEFAULT 'unconfigured' NOT NULL,
	"last_error" text,
	"last_sync_at" timestamp with time zone,
	"last_sync_count" integer,
	"sync_locked_until" timestamp with time zone,
	"query_id" text,
	"site_title" text,
	"owner_handle" text
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" text PRIMARY KEY NOT NULL,
	"sort_index" numeric(30, 0) NOT NULL,
	"author_name" text NOT NULL,
	"author_handle" text NOT NULL,
	"author_avatar" text,
	"author_verified" boolean DEFAULT false NOT NULL,
	"text" text NOT NULL,
	"kind" text NOT NULL,
	"media" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"card" jsonb,
	"quote" jsonb,
	"metrics" jsonb NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bookmarks_sort_idx" ON "bookmarks" USING btree ("sort_index" DESC NULLS LAST);