"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Bookmark } from "@/lib/types";

const GAP = 18;
const MOBILE_GAP = 10;

function columnsFor(width: number) {
  if (width < 300) return 1;
  if (width < 760) return 2;
  if (width < 1100) return 3;
  if (width < 1480) return 4;
  return 5;
}

/** Rough rendered height, good enough to keep columns balanced without measuring the DOM. */
function estimateHeight(b: Bookmark, colWidth: number) {
  const charsPerLine = Math.max(18, colWidth / 7.4);
  const lines = (n: number, max: number) => Math.min(max, Math.ceil(n / charsPerLine) + (b.text.match(/\n/g)?.length ?? 0));
  let h = 64; // footer + padding
  if (b.kind === "text" || (b.kind === "link" && !b.card)) {
    const big = b.text.length < 90 ? 1.9 : b.text.length < 200 ? 1.45 : 1.15;
    return h + 40 + lines(b.text.length * big, 12) * 26 * big + (b.quote ? 90 : 0);
  }
  if (b.media.length === 1) {
    const m = b.media[0];
    h += colWidth * Math.min(1.5, Math.max(0.56, m.height / m.width));
  } else if (b.media.length > 1) {
    h += colWidth * 0.75;
  }
  if (b.card) h += (b.card.image ? colWidth * 0.52 : 0) + 80;
  if (b.text) h += lines(b.text.length, b.media.length ? 4 : 6) * 21;
  if (b.quote) h += 90;
  return h;
}

export function Masonry({
  items,
  render,
}: {
  items: Bookmark[];
  render: (item: Bookmark, index: number) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const cols = width ? columnsFor(width) : 0;
  const gap = width && width < 640 ? MOBILE_GAP : GAP;
  // Assignment depends only on the column count, so cards don't hop columns while resizing.
  const columns = useMemo(() => {
    if (!cols) return [];
    const colWidth = 300;
    const heights = new Array<number>(cols).fill(0);
    const out: { item: Bookmark; index: number }[][] = Array.from({ length: cols }, () => []);
    items.forEach((item, index) => {
      const target = heights.indexOf(Math.min(...heights));
      out[target].push({ item, index });
      heights[target] += estimateHeight(item, colWidth);
    });
    return out;
  }, [items, cols]);

  return (
    <div ref={ref} className="flex min-h-[60vh] items-start" style={{ gap }}>
      {columns.map((col, c) => (
        <div key={c} className="flex min-w-0 flex-1 flex-col" style={{ gap }}>
          {col.map(({ item, index }) => (
            <div key={item.id}>{render(item, index)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
