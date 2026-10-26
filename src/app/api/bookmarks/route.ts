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

  const page = await queryBookmarks({ offset, limit: PAGE_SIZE, q, kind });
  return Response.json(page, {
    headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
