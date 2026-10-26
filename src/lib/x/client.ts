import "server-only";
import { ClientTransaction, fetchXDocument } from "x-client-transaction-id";
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

/** DeleteBookmark mutation id, as seen in x.com's own request (October 2026). */
const DELETE_BOOKMARK_QUERY_ID = "Wlmlj2-xzyS1GN3a6cj-mQ";

/**
 * Feature flags exactly as x.com's own Bookmarks request sent them (October 2026).
 * When discovery finds a different list, flags not listed here are sent as false.
 */
const KNOWN_FEATURES: Record<string, boolean> = {
  rweb_video_screen_enabled: false,
  rweb_cashtags_enabled: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: true,
  rweb_tipjar_consumption_enabled: false,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  rweb_cashtags_composer_attachment_enabled: true,
  responsive_web_jetfuel_frame: true,
  rweb_sports_post_context_enabled: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  rweb_conversational_replies_downvote_enabled: false,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  content_disclosure_indicator_enabled: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  responsive_web_nested_quote_preview_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_made_on_x_label_enabled: false,
  responsive_web_grok_community_note_auto_translation_is_enabled: true,
  responsive_web_enhance_cards_enabled: false,
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

/**
 * x.com signs each API request with an `x-client-transaction-id` header derived from its home
 * page and scripts. The generator is built once and reused for an hour; if building it fails,
 * requests go out without the header (which X still accepts for most calls).
 */
let transaction: { instance: Promise<ClientTransaction>; expires: number } | null = null;

async function transactionId(method: string, path: string): Promise<string | null> {
  try {
    if (!transaction || transaction.expires < Date.now()) {
      transaction = {
        instance: fetchXDocument().then((doc) => ClientTransaction.create(doc)),
        expires: Date.now() + 60 * 60_000,
      };
    }
    return await (await transaction.instance).generateTransactionId(method, path);
  } catch {
    transaction = null;
    return null;
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

const BUNDLE_BASE = "https://abs.twimg.com/responsive-web/client-web";

function findOperation(js: string, operation = "Bookmarks"): QueryInfo | null {
  const match = new RegExp(`queryId:"([\\w-]+)",operationName:"${operation}"([\\s\\S]{0,4000}?)\\}\\}`).exec(js);
  if (!match) return null;
  const switches = /featureSwitches:\[([^\]]*)\]/.exec(match[2])?.[1];
  const names = switches ? [...switches.matchAll(/"(\w+)"/g)].map((m) => m[1]) : null;
  return { queryId: match[1], features: featuresFor(names) };
}

/**
 * Finds the current Bookmarks query id (and its feature flags) by reading x.com's web bundle,
 * the same way the website itself learns them. The operation lives either in a script the
 * page loads up front or in the lazily loaded bookmarks chunk listed in main.js's chunk map.
 */
export async function discoverQuery(creds: XCredentials, operation = "Bookmarks"): Promise<QueryInfo | null> {
  const get = (url: string, headers: Record<string, string> = { "user-agent": USER_AGENT }) =>
    request(url, { headers }).then((r) => (r.ok ? r.text() : ""));

  const html = await get("https://x.com/home", { "user-agent": USER_AGENT, cookie: cookieHeader(creds) });
  const scripts = [
    ...new Set([...html.matchAll(/https:\/\/abs\.twimg\.com\/responsive-web\/client-web[\w-]*\/[\w.~-]+\.js/g)].map((m) => m[0])),
  ];
  const main = scripts.find((s) => /\/main\.[\w]+\.js$/.test(s));

  // main.js first: it holds the operation table and, failing that, the chunk map.
  let mainJs = "";
  if (main) {
    mainJs = await get(main);
    const found = findOperation(mainJs, operation);
    if (found) return found;
  }

  // Chunk map entries look like "bundle.Bookmarks":"1a2b3c4". The file name gets an "a" suffix.
  const chunks = [...mainJs.matchAll(/"((?:[\w.~-]*~)?bundle\.Bookmarks[\w.~-]*)":"([0-9a-f]+)"/g)];
  for (const [, name, hash] of chunks) {
    for (const url of [`${BUNDLE_BASE}/${name}.${hash}a.js`, `${BUNDLE_BASE}/${name}.${hash}.js`]) {
      const found = findOperation(await get(url), operation);
      if (found) return found;
    }
  }

  for (const src of scripts.filter((s) => s !== main).slice(0, 12)) {
    const found = findOperation(await get(src), operation);
    if (found) return found;
  }
  return null;
}

export async function fetchBookmarksPage(
  creds: XCredentials,
  query: QueryInfo,
  cursor: string | null,
): Promise<ParsedPage> {
  const variables = { count: 50, includePromotedContent: false, ...(cursor ? { cursor } : {}) };
  const url = new URL(`https://x.com/i/api/graphql/${query.queryId}/Bookmarks`);
  url.searchParams.set("variables", JSON.stringify(variables));
  url.searchParams.set("features", JSON.stringify(query.features));

  const res = await request(url, { headers: await apiHeaders(creds, "GET", url), cache: "no-store" });
  await throwForStatus(res);

  const json = await res.json();
  if (!json?.data && json?.errors?.length) {
    const message: string = json.errors.map((e: { message?: string }) => e.message).join("; ");
    if (/auth|login|csrf/i.test(message)) throw new XAuthError(message);
    throw new XQueryError(message);
  }
  return parseBookmarksPage(json);
}

async function apiHeaders(creds: XCredentials, method: string, url: string | URL) {
  const txid = await transactionId(method, new URL(url).pathname);
  return {
    ...(txid ? { "x-client-transaction-id": txid } : {}),
    authorization: `Bearer ${WEB_BEARER}`,
    cookie: cookieHeader(creds),
    "x-csrf-token": creds.ct0,
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-active-user": "yes",
    "x-twitter-client-language": "en",
    "content-type": "application/json",
    "user-agent": USER_AGENT,
    origin: "https://x.com",
    referer: "https://x.com/i/bookmarks",
  };
}

async function throwForStatus(res: Response) {
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
}

/** Removes a tweet from the account's bookmarks on X (the same call x.com makes). */
export async function deleteBookmark(creds: XCredentials, tweetId: string) {
  const send = async (queryId: string) => {
    const url = `https://x.com/i/api/graphql/${queryId}/DeleteBookmark`;
    const res = await request(url, {
      method: "POST",
      headers: await apiHeaders(creds, "POST", url),
      body: JSON.stringify({ variables: { tweet_id: tweetId }, queryId }),
      cache: "no-store",
    });
    await throwForStatus(res);
    const json = await res.json();
    // X answers "Done", or an error when the tweet already wasn't bookmarked; both mean it's gone.
    if (json?.errors?.length && !/not.*bookmark/i.test(JSON.stringify(json.errors))) {
      throw new XQueryError(json.errors.map((e: { message?: string }) => e.message).join("; "));
    }
  };

  try {
    await send(DELETE_BOOKMARK_QUERY_ID);
  } catch (err) {
    if (!(err instanceof XQueryError)) throw err;
    const discovered = await discoverQuery(creds, "DeleteBookmark").catch(() => null);
    if (!discovered || discovered.queryId === DELETE_BOOKMARK_QUERY_ID) throw err;
    await send(discovered.queryId);
  }
}
