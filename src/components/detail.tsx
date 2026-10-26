"use client";
/* eslint-disable @next/next/no-img-element -- X's CDN already serves sized images. */

import { ArrowUpRight, Check, Eye, Heart, Link2, MessageCircle, Repeat2 } from "lucide-react";
import { useState } from "react";
import { AuthorLine } from "./author";
import { RichText } from "./rich-text";
import { formatCompact, formatDate, imageUrl, tweetUrl } from "@/lib/format";
import type { Bookmark, BookmarkMedia } from "@/lib/types";

function MediaItem({ m }: { m: BookmarkMedia }) {
  const style = { aspectRatio: `${m.width} / ${m.height}` };
  if (m.type !== "photo" && m.videoUrl) {
    return (
      <video
        src={m.videoUrl}
        poster={imageUrl(m.url, "large")}
        controls={m.type === "video"}
        autoPlay={m.type === "gif"}
        loop={m.type === "gif"}
        muted={m.type === "gif"}
        playsInline
        className="w-full rounded-2xl bg-black"
        style={style}
      />
    );
  }
  return (
    <img
      src={imageUrl(m.url, "large")}
      alt={m.alt ?? ""}
      referrerPolicy="no-referrer"
      className="w-full rounded-2xl bg-surface-2 object-cover"
      style={style}
    />
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Heart; value?: number; label: string }) {
  if (value === undefined) return null;
  return (
    <span className="flex items-center gap-1.5" title={label}>
      <Icon className="size-4" />
      <span className="font-mono text-[12px]">{formatCompact(value)}</span>
    </span>
  );
}

export function BookmarkDetail({ b }: { b: Bookmark }) {
  const [copied, setCopied] = useState(false);
  const hasMedia = b.media.length > 0;
  const isText = !hasMedia && !b.card;

  const copy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/b/${b.id}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className={`@container ${hasMedia ? "grid gap-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-8" : "mx-auto max-w-2xl"}`}
    >
      {hasMedia && (
        <div className="flex flex-col gap-3">
          {b.media.map((m, i) => (
            <MediaItem key={i} m={m} />
          ))}
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <AuthorLine
          name={b.authorName}
          handle={b.authorHandle}
          avatar={b.authorAvatar}
          verified={b.authorVerified}
          size={36}
          className="[&_span]:text-[14px]"
        />

        {b.text && (
          <RichText
            text={b.text}
            className={
              isText
                ? "mt-6 font-serif text-[1.65rem] leading-[1.25] tracking-[-0.01em] sm:text-[2rem]"
                : "mt-5 text-[16px] leading-[1.65]"
            }
          />
        )}

        {b.card && (
          <a
            href={b.card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group/link mt-5 block overflow-hidden rounded-2xl border border-line transition-colors hover:bg-surface-2/60"
          >
            {b.card.image && (
              <img src={b.card.image} alt="" referrerPolicy="no-referrer" className="aspect-[1.91/1] w-full object-cover" />
            )}
            <div className="p-4">
              {b.card.domain && (
                <span className="flex items-center gap-1 font-mono text-[11px] tracking-wider text-faint uppercase">
                  {b.card.domain}
                  <ArrowUpRight className="size-3 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                </span>
              )}
              <p className="mt-1 font-semibold tracking-tight">{b.card.title}</p>
              {b.card.description && <p className="mt-1 text-sm text-muted">{b.card.description}</p>}
            </div>
          </a>
        )}

        {b.quote && (
          <a
            href={tweetUrl(b.quote.authorHandle, b.quote.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 block rounded-2xl border border-line p-4 transition-colors hover:bg-surface-2/60"
          >
            <AuthorLine name={b.quote.authorName} handle={b.quote.authorHandle} avatar={b.quote.authorAvatar} size={20} />
            {b.quote.text && <p className="mt-2 text-[14px] leading-relaxed text-muted">{b.quote.text}</p>}
            {b.quote.media && (
              <img
                src={imageUrl(b.quote.media.url, "small")}
                alt=""
                referrerPolicy="no-referrer"
                className="mt-3 max-h-64 w-full rounded-xl object-cover"
              />
            )}
          </a>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-muted">
          <Stat icon={MessageCircle} value={b.metrics.replies} label="Replies" />
          <Stat icon={Repeat2} value={b.metrics.reposts} label="Reposts" />
          <Stat icon={Heart} value={b.metrics.likes} label="Likes" />
          <Stat icon={Eye} value={b.metrics.views} label="Views" />
          <time dateTime={b.postedAt} className="ml-auto font-mono text-[12px] text-faint">
            {formatDate(b.postedAt)}
          </time>
        </div>

        <div className="mt-5 flex gap-2">
          <a
            href={tweetUrl(b.authorHandle, b.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-bg transition-opacity hover:opacity-85"
          >
            Open on X <ArrowUpRight className="size-3.5" />
          </a>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-[13px] font-medium transition-colors hover:bg-surface-2"
          >
            {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
