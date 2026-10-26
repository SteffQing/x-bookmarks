"use client";

import { useSyncExternalStore } from "react";
import { timeAgo } from "./format";

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}

/** "3h ago", kept fresh on the client. Null during server render to avoid hydration mismatches. */
export function useTimeAgo(iso: string | null) {
  return useSyncExternalStore(
    subscribe,
    () => (iso ? timeAgo(iso) : null),
    () => null,
  );
}
