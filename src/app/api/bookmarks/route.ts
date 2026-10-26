import { PAGE_SIZE, queryBookmarks } from "@/lib/data";
import type { KindFilter } from "@/lib/types";

const KINDS = new Set<KindFilter>(["all", "photo", "video", "link", "text"]);

/** Public, read-only pagination and search over the stored bookmarks. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0);
  const q = (params.get("q") ?? "").slice(0, 200);
  const kindParam = params.get("kind") as KindFilter | null;
  const kind = kindParam && KINDS.has(kindParam) ? kindParam : "all";

  // Dates arrive as YYYY-MM-DD (UTC). `to` is inclusive, so query up to the start of the next day.
  const day = (key: string) => {
    const value = params.get(key);
    const date = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
    return date && !Number.isNaN(date.getTime()) ? date : undefined;
  };
  const from = day("from");
  const toDay = day("to");
  const to = toDay ? new Date(toDay.getTime() + 86_400_000) : undefined;

  const page = await queryBookmarks({ offset, limit: PAGE_SIZE, q, kind, from, to });
  return Response.json(page, {
    headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
