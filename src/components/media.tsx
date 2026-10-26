"use client";
/* eslint-disable @next/next/no-img-element -- X's CDN already serves sized images. */

import { Play } from "lucide-react";
import { useState } from "react";
import { imageUrl } from "@/lib/format";
import type { BookmarkMedia } from "@/lib/types";

/** Image that fades in over a shimmering placeholder of the right shape. */
export function FadeImage({
  src,
  alt,
  className = "",
  ratio,
}: {
  src: string;
  alt: string;
  className?: string;
  /** height / width; omit to fill the parent. */
  ratio?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={`relative overflow-hidden ${loaded ? "bg-surface-2" : "shimmer"} ${className}`}
      style={ratio ? { aspectRatio: `1 / ${ratio}` } : undefined}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        ref={(el) => {
          if (el?.complete && el.naturalWidth) setLoaded(true);
        }}
        className={`absolute inset-0 size-full object-cover transition-[opacity,transform,filter] duration-700 ease-out-soft group-hover:scale-[1.035] ${
          loaded ? "opacity-100 blur-0" : "opacity-0 blur-md"
        }`}
      />
    </div>
  );
}

/** Poster that starts a muted, looping preview while hovered. */
function HoverVideo({ media, ratio, className = "" }: { media: BookmarkMedia; ratio?: number; className?: string }) {
  const [active, setActive] = useState(false);
  return (
    <div
      className={`relative ${className}`}
      onPointerEnter={(e) => e.pointerType === "mouse" && setActive(true)}
      onPointerLeave={() => setActive(false)}
    >
      <FadeImage src={imageUrl(media.url, "medium")} alt={media.alt ?? ""} ratio={ratio} className="size-full" />
      {active && media.videoUrl && (
        <video
          src={media.videoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <span className="pointer-events-none absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 font-mono text-[10px] font-medium tracking-wider text-white uppercase backdrop-blur-md">
        {media.type === "gif" ? (
          "GIF"
        ) : (
          <>
            <Play className="size-2.5 fill-current" /> Video
          </>
        )}
      </span>
    </div>
  );
}

function clampRatio(m: BookmarkMedia) {
  return Math.min(1.5, Math.max(0.56, m.height / m.width));
}

/** The media block at the top of a card: one item at its natural shape, or a small mosaic. */
export function CardMedia({ media }: { media: BookmarkMedia[] }) {
  if (media.length === 1) {
    const m = media[0];
    return m.type === "photo" ? (
      <FadeImage src={imageUrl(m.url, "medium")} alt={m.alt ?? ""} ratio={clampRatio(m)} />
    ) : (
      <HoverVideo media={m} ratio={clampRatio(m)} />
    );
  }

  const shown = media.slice(0, 4);
  return (
    <div className="grid aspect-[4/3] grid-cols-2 grid-rows-2 gap-0.5">
      {shown.map((m, i) => {
        const span =
          shown.length === 2 ? "row-span-2" : shown.length === 3 && i === 0 ? "row-span-2" : "";
        return m.type === "photo" ? (
          <FadeImage key={i} src={imageUrl(m.url, "small")} alt={m.alt ?? ""} className={span} />
        ) : (
          <HoverVideo key={i} media={m} className={span} />
        );
      })}
    </div>
  );
}
