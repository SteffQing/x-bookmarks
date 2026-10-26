import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { db?: NodePgDatabase<typeof schema> };

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

/** Lazily creates one pooled connection per server instance. */
export function getDb() {
  if (!globalForDb.db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000 });
    globalForDb.db = drizzle({ client: pool, schema });
  }
  return globalForDb.db;
}

export { schema };
