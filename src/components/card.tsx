"use client";

import { ArrowUpRight, EyeOff, Heart, Quote } from "lucide-react";
import { AuthorLine } from "./author";
import { CardMedia, FadeImage } from "./media";
import { RichText } from "./rich-text";
import { formatCompact, formatDate, hashString, imageUrl } from "@/lib/format";
import type { Bookmark, BookmarkCard as LinkCard, BookmarkQuote } from "@/lib/types";

const TINTS = 6;

function QuoteBlock({ quote }: { quote: BookmarkQuote }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-line bg-bg/40">
      {quote.media && (
        <FadeImage src={imageUrl(quote.media.url, "small")} alt="" ratio={0.5} />
      )}
      <div className="p-3">
        <AuthorLine name={quote.authorName} handle={quote.authorHandle} avatar={quote.authorAvatar} size={16} />
        {quote.text && <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-muted">{quote.text}</p>}
      </div>
    </div>
  );
}

function LinkPreview({ card }: { card: LinkCard }) {
  return (
    <a
      href={card.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="group/link block overflow-hidden"
    >
      {card.image && <FadeImage src={card.image} alt="" ratio={0.52} />}
      <div className="px-3 pt-3 @[260px]:px-4 @[260px]:pt-3.5">
        {card.domain && (
          <span className="flex items-center gap-1 font-mono text-[10.5px] tracking-wider text-faint uppercase">
            {card.domain}
            <ArrowUpRight className="size-3 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
          </span>
        )}
        <h3 className="mt-1 line-clamp-2 text-[15px] leading-snug font-semibold tracking-tight">{card.title}</h3>
        {card.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{card.description}</p>
        )}
      </div>
    </a>
  );
}

function Footer({ b }: { b: Bookmark }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <AuthorLine
        name={b.authorName}
        handle={b.authorHandle}
        avatar={b.authorAvatar}
        verified={b.authorVerified}
        size={22}
        className="flex-1"
      />
      {b.metrics.likes > 0 && (
        <span className="hidden shrink-0 items-center gap-1 font-mono text-[11px] opacity-50 @[230px]:flex">
          <Heart className="size-3" />
          {formatCompact(b.metrics.likes)}
        </span>
      )}
    </div>
  );
}

/** A text-only bookmark rendered as a tinted, typographic quote card. */
function TextCard({ b }: { b: Bookmark }) {
  const tint = (hashString(b.id) % TINTS) + 1;
  const length = b.text.length;
  const size =
    length < 90
      ? "text-[1.3rem] leading-[1.15] @[260px]:text-[1.7rem] @[260px]:leading-[1.12]"
      : length < 200
        ? "text-[1.1rem] leading-[1.22] @[260px]:text-[1.35rem] @[260px]:leading-[1.2]"
        : "text-[1rem] leading-[1.3] @[260px]:text-[1.12rem]";
  return (
    <div
      className="relative p-3.5 pt-4 @[260px]:p-5 @[260px]:pt-6"
      style={{ background: `var(--tint-${tint}-bg)`, color: `var(--tint-${tint}-ink)` }}
    >
      <Quote className="mb-2 size-4 fill-current opacity-25 @[260px]:mb-3 @[260px]:size-5" strokeWidth={0} />
      <RichText text={b.text} className={`font-serif ${size} line-clamp-[12] tracking-[-0.005em]`} />
      {b.quote && <QuoteBlock quote={b.quote} />}
      <div className="mt-4 border-t border-current/10 pt-3 @[260px]:mt-5 @[260px]:pt-3.5">
        <Footer b={b} />
      </div>
    </div>
  );
}

export function BookmarkCard({
  b,
  index,
  onOpen,
  onHide,
}: {
  b: Bookmark;
  index: number;
  onOpen: (b: Bookmark) => void;
  onHide?: (b: Bookmark) => void;
}) {
  const isText = b.kind === "text" || (b.kind === "link" && !b.card);
  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Bookmark by ${b.authorName}`}
      onClick={() => onOpen(b)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(b);
        }
      }}
      style={{ animationDelay: `${Math.min(index % 30, 12) * 45}ms` }}
      className="group @container animate-rise relative cursor-pointer overflow-hidden rounded-2xl bg-surface sm:rounded-[22px] shadow-card ring-1 ring-line transition-[transform,box-shadow] duration-500 ease-out-soft hover:-translate-y-1 hover:shadow-lift"
    >
      {isText ? (
        <TextCard b={b} />
      ) : (
        <>
          {b.media.length > 0 && <CardMedia media={b.media} />}
          {b.kind === "link" && b.card && <LinkPreview card={b.card} />}
          <div className="p-3 @[260px]:p-4 @[260px]:pt-3.5">
            {b.text && (
              <RichText
                text={b.text}
                className={`text-[13px] leading-[1.5] @[260px]:text-[14px] ${b.media.length ? "line-clamp-4" : "line-clamp-6"} ${b.kind === "link" ? "text-muted" : ""}`}
              />
            )}
            {b.quote && <QuoteBlock quote={b.quote} />}
            <div className={b.text || b.quote ? "mt-3.5" : ""}>
              <Footer b={b} />
            </div>
          </div>
        </>
      )}
      <time
        dateTime={b.postedAt}
        className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/45 px-2 py-0.5 font-mono text-[10px] text-white opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100"
      >
        {formatDate(b.postedAt)}
      </time>
      {onHide && (
        <button
          type="button"
          aria-label="Hide this tweet"
          title="Hide (only in this browser)"
          onClick={(e) => {
            e.stopPropagation();
            onHide(b);
          }}
          className="absolute top-2.5 left-2.5 grid size-7 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100 hover:bg-black/70 focus-visible:opacity-100"
        >
          <EyeOff className="size-3.5" />
        </button>
      )}
    </article>
  );
}
