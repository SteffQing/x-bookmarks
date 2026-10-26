export type MediaKind = "photo" | "video" | "gif";

export interface BookmarkMedia {
  type: MediaKind;
  /** Image URL (the poster frame for videos and gifs). */
  url: string;
  width: number;
  height: number;
  /** Best mp4 rendition, for videos and gifs. */
  videoUrl?: string;
  alt?: string;
}

export interface BookmarkCard {
  url: string;
  title: string;
  description?: string;
  domain?: string;
  image?: string;
}

export interface BookmarkQuote {
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  text: string;
  media?: BookmarkMedia;
}

export interface BookmarkMetrics {
  likes: number;
  reposts: number;
  replies: number;
  views?: number;
}

export type BookmarkKind = "photo" | "video" | "link" | "text";

/** A bookmark as sent to the browser. */
export interface Bookmark {
  id: string;
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
  /** ISO timestamp. */
  postedAt: string;
}

export interface BookmarkPage {
  items: Bookmark[];
  /** Offset for the next page, or null when exhausted. */
  next: number | null;
  total: number;
}

export type KindFilter = BookmarkKind | "all";
