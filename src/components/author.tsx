/* eslint-disable @next/next/no-img-element -- X's CDN already serves sized images. */
import { BadgeCheck } from "lucide-react";

export function Avatar({ src, name, size = 24 }: { src: string | null | undefined; name: string; size?: number }) {
  if (!src) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-surface-2 font-medium text-muted"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
        aria-hidden
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="shrink-0 rounded-full bg-surface-2 object-cover ring-1 ring-line"
      style={{ width: size, height: size }}
    />
  );
}

export function AuthorLine({
  name,
  handle,
  avatar,
  verified,
  meta,
  size = 24,
  className = "",
}: {
  name: string;
  handle: string;
  avatar: string | null | undefined;
  verified?: boolean;
  meta?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <Avatar src={avatar} name={name} size={size} />
      <div className="flex min-w-0 items-baseline gap-1.5 text-[13px] leading-tight">
        <span className="truncate font-medium">{name}</span>
        {verified && <BadgeCheck className="size-3.5 shrink-0 self-center text-accent" aria-label="Verified" />}
        <span className="hidden truncate opacity-60 @[230px]:inline">@{handle}</span>
        {meta && <span className="shrink-0 opacity-50">· {meta}</span>}
      </div>
    </div>
  );
}
