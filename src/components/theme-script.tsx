"use client";

/** Applies the saved or system theme before first paint, so there's no flash. */
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

/**
 * The script only needs to run from the server HTML. On the client it's rendered as inert
 * `text/plain`, which keeps React from warning about script tags during client rendering.
 */
export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
}
