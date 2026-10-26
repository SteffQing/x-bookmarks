# Bookmarks

A Pinterest-style gallery of your X (Twitter) bookmarks that you can share publicly. It doesn't use the official API: you give it your browser session cookies once, and it syncs your bookmarks into its own database every day.

- **`/`**: the public gallery. A masonry grid of image, video, link and text cards, with search, type filters, a detail view and light/dark themes.
- **`/admin`**: password-protected. Paste your X cookies, run a sync, and see the connection status.
- **`/b/:id`**: a shareable page for a single bookmark.

Built with Next.js 16 (Cache Components), Tailwind CSS 4, Motion, Drizzle and Postgres (Neon). It's designed to run on Vercel's free plan.

## How it works

```
Vercel Cron (daily) ─┐
"Sync now" (admin) ──┴─▶ runSync() ─▶ X internal GraphQL "Bookmarks" ─▶ Postgres ─▶ cached gallery
```

1. Your `auth_token` and `ct0` cookies are encrypted with AES-256-GCM and stored in Postgres. They never reach the browser.
2. A sync walks through every page of your bookmarks, using the same internal endpoint x.com uses. It then replaces the stored copy, so anything you un-bookmark disappears on the next sync. If anything fails partway, nothing is deleted.
3. The gallery reads only from the database. It's cached and refreshed after each sync, so visitors never cause requests to X.
4. If X changes its internal query ID, the app reads the new one from x.com's web bundle and retries automatically. You can also set it by hand under **Admin → Gallery → Advanced**.

## Deploy (Vercel + Neon)

1. **Create a database.** Make a free project on [Neon](https://neon.tech) and copy its pooled connection string.
2. **Generate secrets** locally:
   ```bash
   npm install
   npm run setup        # asks for an admin password, prints ADMIN_PASSWORD_HASH, ENCRYPTION_KEY, CRON_SECRET
   ```
3. **Import the repo into Vercel.** Add these environment variables: `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, `ENCRYPTION_KEY` and `CRON_SECRET`. These four never change. The X cookies are stored in the database instead.
4. **Deploy.** The build runs database migrations first (`scripts/migrate.mjs`), then `next build`.
5. **Connect X.** Open `/admin`, log in, and paste your cookies. The first sync runs straight away. After that, Vercel Cron runs it daily (see `vercel.json`).

### Getting the cookies

On x.com, open DevTools → **Network**, click any request to `x.com`, and copy the `cookie` request header. Paste the whole thing; `auth_token` and `ct0` are extracted automatically. Rows copied from **Application → Cookies** and JSON cookie exports also work.

The cookies stay valid until you log out of X in that browser. When they expire, the admin page shows **Cookies expired**, and the public gallery keeps showing the last good sync.

## Local development

```bash
cp .env.example .env.local   # fill in DATABASE_URL + values from `npm run setup`
npm run db:migrate
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Migrate the database, then build for production |
| `npm run setup` | Generate the admin password hash and secrets |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm test` | Unit tests. Set `TEST_DATABASE_URL` to a disposable, migrated database to also run the sync integration tests. |
| `npm run lint` / `npm run typecheck` | Lint and type-check |

## Project layout

```
src/
  app/
    page.tsx              public gallery (cached, tag: "bookmarks")
    admin/                login, dashboard and server actions
    b/[id]/               single-bookmark page
    api/bookmarks/        pagination and search for the gallery
    api/cron/sync/        daily sync, called by Vercel Cron
  components/             gallery, masonry grid, cards, detail view
  db/                     Drizzle schema and client
  lib/
    x/                    everything specific to X: client, response parser, cookie parser
    sync.ts               crawl, store and remove
    auth.ts               admin password, session cookie and login rate limit
    crypto.ts             AES-GCM, key derivation and scrypt
```

## Caveats

- This uses X's private web API. That's against X's terms of service, and X can change it at any time. Everything specific to X lives in `src/lib/x/client.ts`.
- The cookies give full access to your X account. Keep `ENCRYPTION_KEY` and the admin password private.
- Media is loaded directly from X's CDN (`pbs.twimg.com` and `video.twimg.com`). If a tweet is deleted, its media may stop loading.
