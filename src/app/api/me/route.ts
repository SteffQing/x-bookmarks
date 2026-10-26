import { isAdmin } from "@/lib/auth";

/** Lets the (cached, public) gallery know whether to show owner-only controls. */
export async function GET() {
  return Response.json({ admin: await isAdmin() }, { headers: { "cache-control": "private, no-store" } });
}
