/**
 * Integration test for the sync pipeline against a real Postgres (X itself is mocked).
 * Runs only when TEST_DATABASE_URL points at a disposable, migrated database.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;

function tweet(id: string, sortIndex: string, text = `tweet ${id}`) {
  return {
    entryId: `tweet-${id}`,
    sortIndex,
    content: {
      itemContent: {
        tweet_results: {
          result: {
            __typename: "Tweet",
            rest_id: id,
            core: { user_results: { result: { core: { name: "Ada", screen_name: "ada" } } } },
            legacy: { created_at: "Mon Jan 01 00:00:00 +0000 2024", full_text: text, entities: { urls: [] } },
          },
        },
      },
    },
  };
}

function page(entries: unknown[], cursor: string | null) {
  const all = cursor ? [...entries, { entryId: `cursor-bottom-${cursor}`, content: { cursorType: "Bottom", value: cursor } }] : entries;
  return { data: { bookmark_timeline_v2: { timeline: { instructions: [{ type: "TimelineAddEntries", entries: all }] } } } };
}

/** Serves the given pages in order, keyed by cursor. */
function mockX(pages: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const u = new URL(String(input));
      const cursor = JSON.parse(u.searchParams.get("variables") ?? "{}").cursor ?? "start";
      return Response.json(pages[cursor] ?? page([], null));
    }),
  );
}

describe.skipIf(!url)("runSync", () => {
  let mod: typeof import("./sync");
  let db: typeof import("@/db");
  let state: typeof import("./state");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
    mod = await import("./sync");
    db = await import("@/db");
    state = await import("./state");
  });

  beforeEach(async () => {
    const d = db.getDb();
    await d.delete(db.schema.bookmarks);
    await d.delete(db.schema.appState);
    await state.saveCredentials({ authToken: "a".repeat(40), ct0: "b".repeat(32) });
  });

  afterAll(() => vi.unstubAllGlobals());

  const ids = async () =>
    (await db.getDb().select({ id: db.schema.bookmarks.id }).from(db.schema.bookmarks)).map((r) => r.id).sort();

  it("crawls every page, then removes bookmarks that disappeared from X", async () => {
    mockX({
      start: page([tweet("1", "300"), tweet("2", "200")], "c1"),
      c1: page([tweet("3", "100")], "c2"),
      c2: page([], "c3"),
    });
    expect(await mod.runSync()).toEqual({ ok: true, count: 3, added: 3, removed: 0 });
    expect(await ids()).toEqual(["1", "2", "3"]);

    mockX({ start: page([tweet("1", "300", "edited"), tweet("3", "100")], "c1"), c1: page([], "c1") });
    expect(await mod.runSync()).toEqual({ ok: true, count: 2, added: 0, removed: 1 });
    expect(await ids()).toEqual(["1", "3"]);

    const s = await state.getState();
    expect(s?.status).toBe("ok");
    expect(s?.lastSyncCount).toBe(2);
    expect(s?.syncLockedUntil).toBeNull();
  });

  it("keeps the archive intact when X returns something unexpected", async () => {
    mockX({ start: page([tweet("1", "300")], null) });
    await mod.runSync();

    // Discovery fetches (x.com/home) also get this response and find nothing.
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: {} })));
    const result = await mod.runSync();
    expect(result.ok).toBe(false);
    expect(await ids()).toEqual(["1"]);
    expect((await state.getState())?.status).toBe("error");
  });

  it("marks cookies as expired on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    const result = await mod.runSync();
    expect(result.ok).toBe(false);
    expect((await state.getState())?.status).toBe("expired");
  });

  it("refuses to run two syncs at once", async () => {
    await state.updateState({ syncLockedUntil: new Date(Date.now() + 60_000) });
    expect(await mod.runSync()).toMatchObject({ ok: false, skipped: true });
  });
});
