import "server-only";
import type { XCredentials } from "./cookies";
import { parseBookmarksPage, type ParsedPage } from "./parse";

/**
 * Everything specific to X's private web API lives in this file. When X changes something,
 * this is the only place that should need edits.
 */

/** The public bearer token baked into x.com's web client (the same for every user). */
const WEB_BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

/** Used when discovery fails. Can be overridden from the admin page. */
export const FALLBACK_QUERY_ID = "QUmGNbgmiTSb_sMZTr_c2Q";

/** Feature flags the Bookmarks query expects. Discovered flags not listed here are sent as false. */
const KNOWN_FEATURES: Record<string, boolean> = {
  graphql_timeline_v2_bookmark_timeline: true,
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  premium_content_api_read_enabled: false,
  payments_enabled: false,
};

export class XAuthError extends Error {
  name = "XAuthError";
}
export class XQueryError extends Error {
  name = "XQueryError";
}
export class XRateLimitError extends Error {
  name = "XRateLimitError";
}

export interface QueryInfo {
  queryId: string;
  features: Record<string, boolean>;
}

/** fetch, with network failures turned into a readable message. */
async function request(url: string | URL, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (err) {
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : String(err);
    throw new Error(`Couldn’t reach x.com (${cause}).`);
  }
}

function cookieHeader({ authToken, ct0 }: XCredentials) {
  return `auth_token=${authToken}; ct0=${ct0}`;
}

function featuresFor(switches: string[] | null): Record<string, boolean> {
  if (!switches?.length) return KNOWN_FEATURES;
  return Object.fromEntries(switches.map((name) => [name, KNOWN_FEATURES[name] ?? false]));
}

export function defaultQuery(queryId?: string | null): QueryInfo {
  return { queryId: queryId || FALLBACK_QUERY_ID, features: KNOWN_FEATURES };
}

/**
 * Finds the current Bookmarks query id (and its feature flags) by reading x.com's web bundle,
 * the same way the website itself learns them.
 */
export async function discoverQuery(creds: XCredentials): Promise<QueryInfo | null> {
  const headers = { "user-agent": USER_AGENT, cookie: cookieHeader(creds) };
  const html = await request("https://x.com/home", { headers }).then((r) => r.text());
  const scripts = [
    ...html.matchAll(/https:\/\/abs\.twimg\.com\/responsive-web\/client-web[\w-]*\/[\w.~-]+\.js/g),
  ].map((m) => m[0]);
  // main.*.js holds the operation table today; check it first, then any other preloaded bundle.
  scripts.sort((a, b) => Number(/\/main\./.test(b)) - Number(/\/main\./.test(a)));

  for (const src of [...new Set(scripts)].slice(0, 12)) {
    const js = await request(src, { headers: { "user-agent": USER_AGENT } }).then((r) => r.text());
    const match = /queryId:"([\w-]+)",operationName:"Bookmarks"([\s\S]{0,4000}?)\}\}/.exec(js);
    if (!match) continue;
    const switches = /featureSwitches:\[([^\]]*)\]/.exec(match[2])?.[1];
    const names = switches ? [...switches.matchAll(/"([\w]+)"/g)].map((m) => m[1]) : null;
    return { queryId: match[1], features: featuresFor(names) };
  }
  return null;
}

export async function fetchBookmarksPage(
  creds: XCredentials,
  query: QueryInfo,
  cursor: string | null,
): Promise<ParsedPage> {
  const variables = { count: 100, includePromotedContent: false, ...(cursor ? { cursor } : {}) };
  const url = new URL(`https://x.com/i/api/graphql/${query.queryId}/Bookmarks`);
  url.searchParams.set("variables", JSON.stringify(variables));
  url.searchParams.set("features", JSON.stringify(query.features));

  const res = await request(url, {
    headers: {
      authorization: `Bearer ${WEB_BEARER}`,
      cookie: cookieHeader(creds),
      "x-csrf-token": creds.ct0,
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "en",
      "content-type": "application/json",
      "user-agent": USER_AGENT,
      referer: "https://x.com/i/bookmarks",
    },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    throw new XAuthError(`X rejected the cookies (HTTP ${res.status}). Paste fresh ones.`);
  }
  if (res.status === 429) {
    throw new XRateLimitError("X is rate-limiting requests. Try again in ~15 minutes.");
  }
  if (res.status === 400 || res.status === 404 || res.status === 422) {
    const body = await res.text().catch(() => "");
    throw new XQueryError(`X rejected the query (HTTP ${res.status}). ${body.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(`X returned HTTP ${res.status}.`);

  const json = await res.json();
  if (!json?.data && json?.errors?.length) {
    const message: string = json.errors.map((e: { message?: string }) => e.message).join("; ");
    if (/auth|login|csrf/i.test(message)) throw new XAuthError(message);
    throw new XQueryError(message);
  }
  return parseBookmarksPage(json);
}
