import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { deriveKey, verifyPassword } from "./crypto";

const COOKIE = "xb_admin";
const SESSION_DAYS = 7;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function isAdmin() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, deriveKey("session"), { audience: "admin" });
    return true;
  } catch {
    return false;
  }
}

/** Throws unless the request carries a valid admin session. Call at the top of every admin action. */
export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}

async function clientKey() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return `login:${ip}`;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(password: string): Promise<LoginResult> {
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored) return { ok: false, error: "ADMIN_PASSWORD_HASH is not configured on the server." };

  const db = getDb();
  const key = await clientKey();
  const now = new Date();

  const [attempt] = await db
    .select()
    .from(schema.loginAttempts)
    .where(eq(schema.loginAttempts.key, key));
  if (attempt && attempt.resetAt > now && attempt.count >= MAX_ATTEMPTS) {
    const minutes = Math.ceil((attempt.resetAt.getTime() - now.getTime()) / 60_000);
    return { ok: false, error: `Too many attempts. Try again in ${minutes} min.` };
  }

  if (!(await verifyPassword(password, stored))) {
    const resetAt = new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
    await db
      .insert(schema.loginAttempts)
      .values({ key, count: 1, resetAt })
      .onConflictDoUpdate({
        target: schema.loginAttempts.key,
        set: {
          count: sql`case when ${schema.loginAttempts.resetAt} > now() then ${schema.loginAttempts.count} + 1 else 1 end`,
          resetAt: sql`case when ${schema.loginAttempts.resetAt} > now() then ${schema.loginAttempts.resetAt} else ${resetAt} end`,
        },
      });
    return { ok: false, error: "That password isn’t right." };
  }

  await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, key));
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("admin")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(deriveKey("session"));

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return { ok: true };
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}
