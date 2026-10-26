/**
 * Streams X video files through this site. Used only as a fallback when the browser can't load
 * video.twimg.com directly. Range requests pass through so seeking works.
 */
const ALLOWED_HOSTS = new Set(["video.twimg.com"]);

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("u");
  let url: URL;
  try {
    url = new URL(target ?? "");
  } catch {
    return new Response("Bad url", { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    return new Response("Host not allowed", { status: 400 });
  }

  const range = request.headers.get("range");
  const upstream = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", ...(range ? { range } : {}) },
  });

  const headers = new Headers({ "cache-control": "public, max-age=86400, immutable" });
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
