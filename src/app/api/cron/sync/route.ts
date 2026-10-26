import { revalidateTag } from "next/cache";
import { BOOKMARKS_TAG } from "@/lib/data";
import { runSync } from "@/lib/sync";

export const maxDuration = 300;

/** Called daily by Vercel Cron (see vercel.json), which sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runSync();
  if (result.ok) revalidateTag(BOOKMARKS_TAG, { expire: 0 });
  return Response.json(result, { status: result.ok || "skipped" in result ? 200 : 500 });
}
