"use client";

import { AnimatePresence, motion } from "motion/react";
import { Bookmark as BookmarkIcon, Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookmarkCard } from "./card";
import { BookmarkDetail } from "./detail";
import { Masonry } from "./masonry";
import { ThemeToggle } from "./theme-toggle";
import { formatNumber } from "@/lib/format";
import { useTimeAgo } from "@/lib/use-time-ago";
import type { Bookmark, BookmarkPage, KindFilter } from "@/lib/types";
import type { SiteInfo } from "@/lib/data";

const KINDS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "photo", label: "Photos" },
  { value: "video", label: "Videos" },
  { value: "link", label: "Links" },
  { value: "text", label: "Words" },
];

const iconButton =
  "grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink";

async function fetchPage(offset: number, q: string, kind: KindFilter): Promise<BookmarkPage> {
  const params = new URLSearchParams({ offset: String(offset) });
  if (q) params.set("q", q);
  if (kind !== "all") params.set("kind", kind);
  const res = await fetch(`/api/bookmarks?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function SyncedAgo({ iso }: { iso: string }) {
  // Computed on the client: the page is cached, so a server-rendered "x ago" would go stale.
  return <span>synced {useTimeAgo(iso) ?? "recently"}</span>;
}

export function Gallery({ site, initial }: { site: SiteInfo; initial: BookmarkPage }) {
  const [items, setItems] = useState(initial.items);
  const [next, setNext] = useState(initial.next);
  const [total, setTotal] = useState(initial.total);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<Bookmark | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  const filtered = q.trim() !== "" || kind !== "all";

  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Applies a new search/filter: resets to the cached first page, or queries the API (debounced while typing). */
  const applyFilter = (nextQ: string, nextKind: KindFilter) => {
    setQ(nextQ);
    setKind(nextKind);
    clearTimeout(debounce.current);
    const id = ++request.current;
    const term = nextQ.trim();
    if (!term && nextKind === "all") {
      setItems(initial.items);
      setNext(initial.next);
      setTotal(initial.total);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const page = await fetchPage(0, term, nextKind);
        if (id !== request.current) return;
        setItems(page.items);
        setNext(page.next);
        setTotal(page.total);
      } catch {
        // Keep showing the previous results; the next change retries.
      } finally {
        if (id === request.current) setLoading(false);
      }
    }, nextKind === kind && term ? 250 : 0);
  };

  const loadMore = useCallback(async () => {
    if (next === null || loading) return;
    const id = request.current;
    setLoading(true);
    try {
      const page = await fetchPage(next, q.trim(), kind);
      if (id !== request.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((b) => b.id));
        return [...prev, ...page.items.filter((b) => !seen.has(b.id))];
      });
      setNext(page.next);
    } catch {
      // Leave `next` as is so scrolling retries.
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [next, loading, q, kind]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), {
      rootMargin: "1200px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 140);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard: ⌘K or / opens search, Escape closes whatever is on top.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape") {
        if (selected) history.back();
        else setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // The open bookmark lives in history (?b=id) so Back closes it and the URL is shareable.
  const open = useCallback((b: Bookmark) => {
    setSelected(b);
    history.pushState({ bookmark: b.id }, "", `?b=${b.id}`);
  }, []);

  useEffect(() => {
    const onPop = () => {
      const id = new URLSearchParams(location.search).get("b");
      setSelected((current) => (id && current?.id === id ? current : null));
    };
    window.addEventListener("popstate", onPop);
    const id = new URLSearchParams(location.search).get("b");
    if (id) location.replace(`/b/${id}`);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = selected ? "hidden" : "";
  }, [selected]);

  const clear = () => applyFilter("", "all");

  const kindLabel = KINDS.find((k) => k.value === kind)?.label.toLowerCase();

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-500 ${
          scrolled || searchOpen
            ? "bg-bg/75 shadow-[0_1px_0_var(--line)] backdrop-blur-xl backdrop-saturate-150"
            : ""
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1720px] items-center justify-between gap-4 px-4 sm:px-8">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className={`flex items-center gap-2.5 transition-all duration-500 ease-out-soft ${
              scrolled ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"
            }`}
          >
            <span className="grid size-7 place-items-center rounded-lg bg-ink text-bg">
              <BookmarkIcon className="size-3.5 fill-current" />
            </span>
            <span className="font-serif text-xl">{site.title}</span>
          </button>

          <div className="flex items-center gap-1">
            {filtered && !searchOpen && (
              <button
                type="button"
                onClick={clear}
                className="mr-1 hidden items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12px] font-medium text-bg sm:flex"
              >
                {q.trim() ? `“${q.trim()}”` : kindLabel}
                <X className="size-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="flex h-9 items-center gap-2 rounded-full px-3 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="Search"
            >
              <Search className="size-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded border border-line px-1.5 font-mono text-[10px] sm:inline">⌘K</kbd>
            </button>
            <ThemeToggle className={iconButton} />
          </div>
        </div>

        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto max-w-[1720px] px-4 pb-4 sm:px-8"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex flex-1 items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-card ring-1 ring-line focus-within:ring-accent/50">
                  <Search className="size-4 text-faint" />
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => applyFilter(e.target.value, kind)}
                    onKeyDown={(e) => e.key === "Enter" && setSearchOpen(false)}
                    placeholder="Search words, people, links…"
                    className="w-full bg-transparent text-[15px] outline-none placeholder:text-faint focus-visible:outline-none"
                  />
                  {loading && <Loader2 className="size-4 animate-spin text-faint" />}
                  {q && (
                    <button type="button" onClick={() => applyFilter("", kind)} aria-label="Clear search" className="text-faint hover:text-ink">
                      <X className="size-4" />
                    </button>
                  )}
                </label>
                <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  {KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => applyFilter(q, k.value)}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
                        kind === k.value ? "bg-ink text-bg" : "text-muted ring-1 ring-line hover:bg-surface-2 hover:text-ink"
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="mx-auto max-w-[1720px] px-2.5 pb-24 sm:px-8">
        <section className="px-1.5 pt-10 pb-10 sm:px-0 sm:pt-16 sm:pb-16">
          <p className="animate-rise font-mono text-[11px] tracking-[0.2em] text-faint uppercase">
            {site.handle ? `@${site.handle.replace(/^@/, "")} · ` : ""}a living archive
          </p>
          <h1
            className="animate-rise mt-4 font-serif text-[clamp(3.4rem,11vw,9.5rem)] leading-[0.88] tracking-[-0.035em]"
            style={{ animationDelay: "60ms" }}
          >
            {site.title}
            <span className="text-accent">.</span>
          </h1>
          <div
            className="animate-rise mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted"
            style={{ animationDelay: "120ms" }}
          >
            <span className="font-serif text-lg text-ink italic">Things worth keeping,</span>
            <span>
              {formatNumber(site.total)} saved
              {site.lastSyncAt && (
                <>
                  {" · "}
                  <SyncedAgo iso={site.lastSyncAt} />
                </>
              )}
            </span>
          </div>
        </section>

        {filtered && (
          <div className="mb-6 flex items-center gap-3 text-[14px] text-muted">
            <span>
              {loading && !items.length ? "Searching…" : `${formatNumber(total)} ${total === 1 ? "result" : "results"}`}
              {kind !== "all" && <> in {kindLabel}</>}
              {q.trim() && <> for “{q.trim()}”</>}
            </span>
            <button type="button" onClick={clear} className="text-ink underline underline-offset-4 hover:text-accent">
              Clear
            </button>
          </div>
        )}

        {items.length > 0 ? (
          <Masonry items={items} render={(b, i) => <BookmarkCard b={b} index={i} onOpen={open} />} />
        ) : (
          !loading && (
            <div className="grid min-h-[40vh] place-items-center text-center">
              <div>
                <p className="font-serif text-4xl">{filtered ? "Nothing matches." : "No bookmarks yet."}</p>
                <p className="mt-2 text-muted">
                  {filtered ? "Try another word, or clear the filters." : "They’ll appear here after the next sync."}
                </p>
              </div>
            </div>
          )
        )}

        <div ref={sentinel} className="flex h-24 items-center justify-center">
          {loading && items.length > 0 && <Loader2 className="size-5 animate-spin text-faint" />}
          {next === null && items.length > 12 && (
            <span className="font-serif text-xl text-faint italic">That’s everything.</span>
          )}
        </div>
      </main>

      <footer className="mx-auto flex max-w-[1720px] items-center justify-between px-4 pb-10 font-mono text-[11px] tracking-wider text-faint uppercase sm:px-8">
        <span>Synced from X</span>
        <Link href="/admin" className="transition-colors hover:text-ink">
          Owner
        </Link>
      </footer>

      <AnimatePresence>
        {selected && (
          <motion.div
            key="overlay"
            className="fixed inset-0 z-50 overflow-y-auto bg-black/45 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => history.back()}
          >
            <div className="flex min-h-full items-start justify-center p-3 sm:items-center sm:p-8">
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={`Bookmark by ${selected.authorName}`}
                initial={{ opacity: 0, y: 28, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
                className={`relative w-full rounded-[28px] bg-surface p-5 shadow-lift ring-1 ring-line sm:p-8 ${
                  selected.media.length ? "max-w-6xl" : "max-w-3xl"
                }`}
              >
                <button
                  type="button"
                  onClick={() => history.back()}
                  aria-label="Close"
                  className={`${iconButton} absolute top-3 right-3 z-10 bg-surface/80 backdrop-blur`}
                >
                  <X className="size-4" />
                </button>
                <BookmarkDetail b={selected} />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
