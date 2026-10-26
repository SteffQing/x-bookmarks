"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Tweets a visitor chose to hide. Kept only in their own browser. */
const KEY = "hidden-bookmarks";
const EMPTY: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
let cache: { raw: string | null; set: ReadonlySet<string> } = { raw: null, set: EMPTY };

function read(): ReadonlySet<string> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cache.raw) {
    let ids: unknown = [];
    try {
      ids = JSON.parse(raw ?? "[]");
    } catch {}
    cache = { raw, set: new Set(Array.isArray(ids) ? ids.filter((i) => typeof i === "string") : []) };
  }
  return cache.set;
}

function write(set: ReadonlySet<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useHidden() {
  const hidden = useSyncExternalStore(subscribe, read, () => EMPTY);
  const hide = useCallback((id: string) => write(new Set(read()).add(id)), []);
  const unhideAll = useCallback(() => write(new Set()), []);
  return { hidden, hide, unhideAll };
}
