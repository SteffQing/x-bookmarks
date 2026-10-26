"use client";

import { ArrowLeft, ArrowRight, Loader2, LockKeyhole, LogOut, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { useTimeAgo } from "@/lib/use-time-ago";
import {
  loginAction,
  logoutAction,
  saveCookiesAction,
  saveSettingsAction,
  syncAction,
  type ActionState,
} from "./actions";

const panel = "w-full rounded-[28px] bg-surface p-6 shadow-card ring-1 ring-line sm:p-8";
const input =
  "w-full rounded-xl bg-bg px-4 py-3 text-[15px] ring-1 ring-line outline-none transition-shadow placeholder:text-faint focus:ring-2 focus:ring-accent/60";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-bg transition-opacity hover:opacity-85 disabled:opacity-50";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium ring-1 ring-line transition-colors hover:bg-surface-2 disabled:opacity-50";
const label = "font-mono text-[11px] tracking-[0.16em] text-faint uppercase";

function Message({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-[13px] leading-snug ${state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-accent"}`}>
      {state.message}
    </p>
  );
}

function Ago({ iso, fallback }: { iso: string | null; fallback: string }) {
  const text = useTimeAgo(iso);
  return <>{iso ? (text ?? "…") : fallback}</>;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <div className="flex w-full max-w-sm flex-1 flex-col justify-center">
      <form action={action} className={`${panel} animate-rise`}>
        <span className="grid size-11 place-items-center rounded-2xl bg-ink text-bg">
          <LockKeyhole className="size-5" />
        </span>
        <h1 className="mt-6 font-serif text-4xl tracking-tight">Owner access</h1>
        <p className="mt-2 text-[14px] text-muted">Enter the password to manage this gallery.</p>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          placeholder="Password"
          aria-label="Password"
          className={`${input} mt-6`}
        />
        <div className="mt-4 min-h-5">
          <Message state={state} />
        </div>
        <button type="submit" disabled={pending} className={`${primary} mt-2 w-full`}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <>Continue <ArrowRight className="size-4" /></>}
        </button>
      </form>
      <Link href="/" className="mt-6 flex items-center justify-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Back to the gallery
      </Link>
    </div>
  );
}

const STATUS = {
  ok: { dot: "bg-emerald-500", text: "Connected" },
  expired: { dot: "bg-amber-500", text: "Cookies expired" },
  error: { dot: "bg-accent", text: "Last sync failed" },
  unconfigured: { dot: "bg-faint", text: "Not connected" },
} as const;

export function Dashboard(props: {
  status: keyof typeof STATUS;
  lastError: string | null;
  lastSyncAt: string | null;
  credentialsUpdatedAt: string | null;
  count: number;
  siteTitle: string;
  ownerHandle: string;
  queryId: string;
}) {
  const [cookieState, saveCookies, savingCookies] = useActionState(saveCookiesAction, null);
  const [settingsState, saveSettings, savingSettings] = useActionState(saveSettingsAction, null);
  const [syncState, setSyncState] = useState<ActionState>(null);
  const [syncing, startSync] = useTransition();
  const status = STATUS[props.status];
  const busy = syncing || savingCookies;

  return (
    <div className="w-full max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <ArrowLeft className="size-3.5" /> View gallery
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
            <LogOut className="size-3.5" /> Log out
          </button>
        </form>
      </div>

      <section className={`${panel} animate-rise`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl tracking-tight">Dashboard</h1>
            <p className="mt-2 flex items-center gap-2 text-[14px] text-muted">
              <span className={`size-2 rounded-full ${status.dot}`} />
              {status.text}
            </p>
          </div>
          <button
            type="button"
            disabled={busy || props.status === "unconfigured"}
            onClick={() => startSync(async () => setSyncState(await syncAction()))}
            className={primary}
          >
            <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>

        <dl className="mt-7 grid grid-cols-3 gap-4 border-t border-line pt-6">
          {[
            ["Bookmarks", formatNumber(props.count)],
            ["Last sync", <Ago key="s" iso={props.lastSyncAt} fallback="never" />],
            ["Cookies set", <Ago key="c" iso={props.credentialsUpdatedAt} fallback="never" />],
          ].map(([term, value], i) => (
            <div key={i}>
              <dt className={label}>{term}</dt>
              <dd className="mt-1.5 font-serif text-2xl">{value}</dd>
            </div>
          ))}
        </dl>

        {(syncState || (props.lastError && props.status !== "ok")) && (
          <div className="mt-5 rounded-xl bg-bg px-4 py-3 ring-1 ring-line">
            {syncState ? <Message state={syncState} /> : <p className="text-[13px] text-accent">{props.lastError}</p>}
          </div>
        )}
      </section>

      <form action={saveCookies} className={`${panel} animate-rise`} style={{ animationDelay: "60ms" }}>
        <h2 className="text-lg font-semibold tracking-tight">X cookies</h2>
        <p className="mt-1 text-[14px] text-muted">
          Paste your x.com <code className="font-mono text-[13px] text-ink">cookie</code> header (or just{" "}
          <code className="font-mono text-[13px] text-ink">auth_token</code> and{" "}
          <code className="font-mono text-[13px] text-ink">ct0</code>). They’re encrypted before being stored and never
          leave the server.
        </p>
        <textarea
          name="cookies"
          required
          rows={4}
          spellCheck={false}
          autoComplete="off"
          placeholder="auth_token=…; ct0=…"
          className={`${input} mt-5 resize-y font-mono text-[13px] leading-relaxed`}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Message state={cookieState} />
          </div>
          <button type="submit" disabled={busy} className={primary}>
            {savingCookies ? <Loader2 className="size-4 animate-spin" /> : null}
            {savingCookies ? "Saving & syncing…" : "Save & sync"}
          </button>
        </div>
      </form>

      <form action={saveSettings} className={`${panel} animate-rise`} style={{ animationDelay: "120ms" }}>
        <h2 className="text-lg font-semibold tracking-tight">Gallery</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Title</span>
            <input name="siteTitle" defaultValue={props.siteTitle} placeholder="Bookmarks" maxLength={60} className={`${input} mt-2`} />
          </label>
          <label className="block">
            <span className={label}>Your X handle</span>
            <input name="ownerHandle" defaultValue={props.ownerHandle} placeholder="@you" maxLength={31} className={`${input} mt-2`} />
          </label>
        </div>
        <details className="group mt-5">
          <summary className="cursor-pointer text-[13px] text-muted select-none hover:text-ink">Advanced</summary>
          <label className="mt-4 block">
            <span className={label}>Bookmarks query ID</span>
            <input
              name="queryId"
              defaultValue={props.queryId}
              placeholder="Discovered automatically"
              className={`${input} mt-2 font-mono text-[13px]`}
            />
            <span className="mt-2 block text-[12px] text-faint">
              Only needed if X changes its API and automatic discovery fails.
            </span>
          </label>
        </details>
        <div className="mt-5 flex items-center justify-between gap-3">
          <Message state={settingsState} />
          <button type="submit" disabled={savingSettings} className={`${secondary} ml-auto`}>
            {savingSettings && <Loader2 className="size-3.5 animate-spin" />} Save
          </button>
        </div>
      </form>
    </div>
  );
}
