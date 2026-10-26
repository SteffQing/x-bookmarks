"use client";

import { Fragment } from "react";

const TOKEN = /(https?:\/\/[^\s]+)|(@\w{1,15})|(#[\p{L}\p{N}_]+)/gu;

function prettyUrl(url: string) {
  try {
    const u = new URL(url);
    const path = (u.pathname + u.search).replace(/\/$/, "");
    const shown = u.hostname.replace(/^www\./, "") + path;
    return shown.length > 32 ? `${shown.slice(0, 31)}…` : shown;
  } catch {
    return url;
  }
}

const linkClass =
  "text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:decoration-accent";

/** Renders tweet text with clickable links, mentions and hashtags. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const [token, url, mention, tag] = match;
    const href = url
      ? url
      : mention
        ? `https://x.com/${mention.slice(1)}`
        : `https://x.com/hashtag/${encodeURIComponent(tag!.slice(1))}`;
    parts.push(
      <a
        key={index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        onClick={(e) => e.stopPropagation()}
      >
        {url ? prettyUrl(url) : token}
      </a>,
    );
    last = index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return (
    <p className={`whitespace-pre-line break-words ${className ?? ""}`}>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </p>
  );
}
