const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-US");
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export const formatCompact = (n: number) => compact.format(n);
export const formatNumber = (n: number) => full.format(n);
/** UTC so server and client render the same string. */
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));

export function timeAgo(iso: string, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, "y"],
    [60 * 60 * 24 * 30, "mo"],
    [60 * 60 * 24 * 7, "w"],
    [60 * 60 * 24, "d"],
    [60 * 60, "h"],
    [60, "m"],
  ];
  for (const [size, label] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${label} ago`;
  }
  return "just now";
}

/** Stable small hash, used to pick a tint per bookmark. */
export function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function tweetUrl(handle: string, id: string) {
  return `https://x.com/${handle}/status/${id}`;
}

/** Requests an appropriately sized rendition from X's image CDN. */
export function imageUrl(url: string, size: "small" | "medium" | "large" | "orig" = "medium") {
  if (!url.includes("pbs.twimg.com/media/")) return url;
  const u = new URL(url);
  const ext = u.pathname.split(".").pop();
  if (ext && /^(jpe?g|png|webp)$/.test(ext)) {
    u.pathname = u.pathname.replace(/\.\w+$/, "");
    u.searchParams.set("format", ext === "jpeg" ? "jpg" : ext);
  }
  u.searchParams.set("name", size);
  return u.toString();
}
