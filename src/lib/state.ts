import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { decrypt, encrypt } from "./crypto";
import type { XCredentials } from "./x/cookies";

export type AppState = typeof schema.appState.$inferSelect;

export async function getState(): Promise<AppState | null> {
  const [row] = await getDb().select().from(schema.appState).where(eq(schema.appState.id, 1));
  return row ?? null;
}

export async function updateState(values: Partial<Omit<AppState, "id">>) {
  await getDb()
    .insert(schema.appState)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: schema.appState.id, set: values });
}

export async function saveCredentials(creds: XCredentials) {
  await updateState({
    credentials: encrypt(JSON.stringify(creds)),
    credentialsUpdatedAt: new Date(),
    status: "ok",
    lastError: null,
  });
}

export function readCredentials(state: AppState | null): XCredentials | null {
  if (!state?.credentials) return null;
  try {
    return JSON.parse(decrypt(state.credentials)) as XCredentials;
  } catch {
    return null;
  }
}
