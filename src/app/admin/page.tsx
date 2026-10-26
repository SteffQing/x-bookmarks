import type { Metadata } from "next";
import { Suspense } from "react";
import { hasDatabase } from "@/db";
import { isAdmin } from "@/lib/auth";
import { queryBookmarks } from "@/lib/data";
import { getState } from "@/lib/state";
import { Dashboard, LoginForm } from "./forms";

export const metadata: Metadata = { title: "Owner", robots: { index: false, follow: false } };

// A sync triggered from this page can take a while for large collections.
export const maxDuration = 300;

async function Gate() {
  if (!hasDatabase()) {
    return (
      <p className="text-center text-muted">
        <code className="font-mono text-ink">DATABASE_URL</code> isn’t set on the server yet.
      </p>
    );
  }
  if (!(await isAdmin())) return <LoginForm />;

  const [state, { total: count }] = await Promise.all([getState(), queryBookmarks({ limit: 0 })]);
  return (
    <Dashboard
      status={state?.status ?? "unconfigured"}
      lastError={state?.lastError ?? null}
      lastSyncAt={state?.lastSyncAt?.toISOString() ?? null}
      credentialsUpdatedAt={state?.credentialsUpdatedAt?.toISOString() ?? null}
      count={count}
      siteTitle={state?.siteTitle ?? ""}
      ownerHandle={state?.ownerHandle ?? ""}
      queryId={state?.queryId ?? ""}
    />
  );
}

export default function AdminPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="shimmer h-72 w-full max-w-md rounded-[28px]" />}>
        <Gate />
      </Suspense>
    </main>
  );
}
