import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const ghostCards = [
  { rotate: "-8deg", x: "-58%", y: "6%", tint: 1, h: "h-56" },
  { rotate: "5deg", x: "-8%", y: "-4%", tint: 3, h: "h-64" },
  { rotate: "-2deg", x: "40%", y: "10%", tint: 4, h: "h-52" },
];

/** Shown on the public page until the owner connects an X account. */
export function SetupState() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="flex justify-end p-4 sm:p-8">
        <ThemeToggle className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink" />
      </div>

      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <div className="relative mb-14 h-64 w-full max-w-md" aria-hidden>
          {ghostCards.map((c, i) => (
            <div
              key={i}
              className={`animate-rise absolute top-0 left-1/2 w-44 ${c.h} rounded-[22px] shadow-lift ring-1 ring-line`}
              style={{
                transform: `translate(${c.x}, ${c.y}) rotate(${c.rotate})`,
                background: `var(--tint-${c.tint}-bg)`,
                animationDelay: `${i * 90}ms`,
              }}
            >
              <div className="space-y-2 p-5 opacity-30" style={{ color: `var(--tint-${c.tint}-ink)` }}>
                <div className="h-2.5 w-3/4 rounded-full bg-current" />
                <div className="h-2.5 w-full rounded-full bg-current" />
                <div className="h-2.5 w-2/3 rounded-full bg-current" />
              </div>
            </div>
          ))}
        </div>

        <p className="animate-rise font-mono text-[11px] tracking-[0.2em] text-faint uppercase">Not set up yet</p>
        <h1
          className="animate-rise mt-4 font-serif text-[clamp(2.8rem,8vw,5.5rem)] leading-[0.95] tracking-[-0.03em]"
          style={{ animationDelay: "60ms" }}
        >
          An empty shelf<span className="text-accent">.</span>
        </h1>
        <p className="animate-rise mt-5 max-w-md text-[15px] leading-relaxed text-muted" style={{ animationDelay: "120ms" }}>
          This gallery fills itself with bookmarks from X once its owner connects an account. Nothing to see quite yet.
        </p>
        <Link
          href="/admin"
          className="animate-rise group mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-bg transition-opacity hover:opacity-85"
          style={{ animationDelay: "180ms" }}
        >
          Set your secrets
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </main>
  );
}
