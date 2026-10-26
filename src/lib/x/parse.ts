import type {
  BookmarkCard,
  BookmarkKind,
  BookmarkMedia,
  BookmarkMetrics,
  BookmarkQuote,
} from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any -- X's GraphQL payloads are untyped and change often. */

export interface ParsedBookmark {
  id: string;
  sortIndex: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string | null;
  authorVerified: boolean;
  text: string;
  kind: BookmarkKind;
  media: BookmarkMedia[];
  card: BookmarkCard | null;
  quote: BookmarkQuote | null;
  metrics: BookmarkMetrics;
  postedAt: Date;
}

export interface ParsedPage {
  bookmarks: ParsedBookmark[];
  nextCursor: string | null;
  /** False when the response had no bookmark timeline at all (wrong query or features). */
  valid: boolean;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

function decodeEntities(s: string) {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m);
}

/** Unwraps `TweetWithVisibilityResults` and similar wrappers. */
function unwrapTweet(result: any): any | null {
  if (!result) return null;
  if (result.__typename === "TweetWithVisibilityResults") return result.tweet ?? null;
  if (result.__typename === "TweetTombstone" || result.__typename === "TweetUnavailable") return null;
  return result.legacy ? result : (result.tweet ?? null);
}

function parseUser(tweet: any) {
  const user = tweet?.core?.user_results?.result ?? {};
  const legacy = user.legacy ?? {};
  const core = user.core ?? {};
  const avatar: string | undefined = user.avatar?.image_url ?? legacy.profile_image_url_https;
  return {
    name: decodeEntities(core.name ?? legacy.name ?? "Unknown"),
    handle: core.screen_name ?? legacy.screen_name ?? "unknown",
    avatar: avatar ? avatar.replace("_normal.", "_bigger.") : null,
    verified: Boolean(user.is_blue_verified || legacy.verified),
  };
}

function bestVideo(media: any): string | undefined {
  const variants: any[] = media.video_info?.variants ?? [];
  const mp4 = variants
    .filter((v) => v.content_type === "video/mp4" && v.url)
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  // The top rendition is often 1080p+; the second-best is plenty for a card and loads faster.
  return (mp4.length > 1 ? mp4[1] : mp4[0])?.url;
}

function parseMedia(legacy: any): BookmarkMedia[] {
  const list: any[] = legacy.extended_entities?.media ?? legacy.entities?.media ?? [];
  return list.map((m) => {
    const type = m.type === "video" ? "video" : m.type === "animated_gif" ? "gif" : "photo";
    return {
      type,
      url: m.media_url_https,
      width: m.original_info?.width ?? m.sizes?.large?.w ?? 1200,
      height: m.original_info?.height ?? m.sizes?.large?.h ?? 1200,
      ...(type !== "photo" ? { videoUrl: bestVideo(m) } : {}),
      ...(m.ext_alt_text ? { alt: m.ext_alt_text } : {}),
    } satisfies BookmarkMedia;
  });
}

function bindingValue(values: any[], key: string): any {
  return values.find((v) => v.key === key)?.value;
}

function parseCard(tweet: any, expandedUrls: string[]): BookmarkCard | null {
  const legacy = tweet.card?.legacy;
  if (!legacy) return null;
  const values: any[] = legacy.binding_values ?? [];
  const title = bindingValue(values, "title")?.string_value;
  if (!title) return null;
  const image =
    bindingValue(values, "thumbnail_image_original")?.image_value?.url ??
    bindingValue(values, "photo_image_full_size_original")?.image_value?.url ??
    bindingValue(values, "summary_photo_image_original")?.image_value?.url;
  const domain = bindingValue(values, "vanity_url")?.string_value ?? bindingValue(values, "domain")?.string_value;
  const cardUrl: string | undefined = bindingValue(values, "card_url")?.string_value ?? legacy.url;
  // card_url is a t.co link; prefer the expanded URL from the tweet's entities.
  const url = expandedUrls.find((u) => domain && u.includes(domain)) ?? expandedUrls.at(-1) ?? cardUrl ?? "";
  return {
    url,
    title,
    description: bindingValue(values, "description")?.string_value,
    domain,
    image,
  };
}

/** Full text with t.co links expanded, trailing media links removed and entities decoded. */
function parseText(tweet: any): { text: string; urls: string[] } {
  const legacy = tweet.legacy;
  const note = tweet.note_tweet?.note_tweet_results?.result;
  // Decode first: display_text_range counts characters of the unescaped text.
  let text = decodeEntities(note?.text ?? legacy.full_text ?? "");
  const urlEntities: any[] = note?.entity_set?.urls ?? legacy.entities?.urls ?? [];
  const mediaUrls: string[] = (legacy.extended_entities?.media ?? legacy.entities?.media ?? []).map((m: any) => m.url);

  // Strip leading @mentions that only exist because this is a reply.
  const range: [number, number] | undefined = note ? undefined : legacy.display_text_range;
  if (range) text = Array.from(text).slice(range[0], range[1]).join("");

  for (const u of urlEntities) {
    if (u.url && u.expanded_url) text = text.split(u.url).join(u.expanded_url);
  }
  for (const m of mediaUrls) text = text.split(m).join("");
  // A quote tweet's permalink is redundant with the embedded quote.
  const quotedPermalink: string | undefined = legacy.quoted_status_permalink?.expanded;
  if (quotedPermalink) text = text.split(quotedPermalink).join("");

  return {
    text: text.trim(),
    urls: urlEntities.map((u) => u.expanded_url).filter(Boolean),
  };
}

function parseQuote(tweet: any): BookmarkQuote | null {
  const quoted = unwrapTweet(tweet.quoted_status_result?.result);
  if (!quoted?.legacy) return null;
  const user = parseUser(quoted);
  const media = parseMedia(quoted.legacy);
  return {
    id: quoted.rest_id,
    authorName: user.name,
    authorHandle: user.handle,
    authorAvatar: user.avatar ?? undefined,
    text: parseText(quoted).text,
    ...(media[0] ? { media: media[0] } : {}),
  };
}

export function parseTweet(result: any, sortIndex: string): ParsedBookmark | null {
  const tweet = unwrapTweet(result);
  if (!tweet?.legacy || !tweet.rest_id) return null;
  const legacy = tweet.legacy;
  const user = parseUser(tweet);
  const media = parseMedia(legacy);
  const { text, urls } = parseText(tweet);
  const card = media.length ? null : parseCard(tweet, urls);

  const kind: BookmarkKind = media.some((m) => m.type !== "photo")
    ? "video"
    : media.length
      ? "photo"
      : card || urls.length
        ? "link"
        : "text";

  const views = Number(tweet.views?.count);
  return {
    id: tweet.rest_id,
    sortIndex,
    authorName: user.name,
    authorHandle: user.handle,
    authorAvatar: user.avatar,
    authorVerified: user.verified,
    text,
    kind,
    media,
    card,
    quote: parseQuote(tweet),
    metrics: {
      likes: legacy.favorite_count ?? 0,
      reposts: (legacy.retweet_count ?? 0) + (legacy.quote_count ?? 0),
      replies: legacy.reply_count ?? 0,
      ...(Number.isFinite(views) ? { views } : {}),
    },
    postedAt: new Date(legacy.created_at),
  };
}

/** Parses one page of the Bookmarks GraphQL response. */
export function parseBookmarksPage(json: any): ParsedPage {
  const instructions: any[] | undefined =
    json?.data?.bookmark_timeline_v2?.timeline?.instructions ??
    json?.data?.bookmark_timeline?.timeline?.instructions;
  if (!Array.isArray(instructions)) return { bookmarks: [], nextCursor: null, valid: false };

  const bookmarks: ParsedBookmark[] = [];
  let nextCursor: string | null = null;

  for (const instruction of instructions) {
    const entries: any[] =
      instruction.type === "TimelineAddEntries"
        ? (instruction.entries ?? [])
        : instruction.type === "TimelineReplaceEntry" && instruction.entry
          ? [instruction.entry]
          : [];
    for (const entry of entries) {
      const content = entry.content ?? {};
      if (content.cursorType === "Bottom" || String(entry.entryId).startsWith("cursor-bottom")) {
        nextCursor = content.value ?? null;
        continue;
      }
      const result = content.itemContent?.tweet_results?.result;
      if (!result) continue;
      const parsed = parseTweet(result, String(entry.sortIndex ?? "0"));
      if (parsed) bookmarks.push(parsed);
    }
  }

  return { bookmarks, nextCursor, valid: true };
}
