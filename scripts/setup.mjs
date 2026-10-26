#!/usr/bin/env node
// Generates the secrets this app needs. Run with: npm run setup
// Prints lines to paste into Vercel → Settings → Environment Variables (and .env.local).
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const rl = createInterface({ input: stdin, output: stdout });
const password = await rl.question("Choose an admin password (12+ characters recommended): ");
rl.close();

if (password.length < 8) {
  console.error("\nPassword must be at least 8 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = await new Promise((resolve, reject) =>
  scrypt(password, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) =>
    err ? reject(err) : resolve(key),
  ),
);

console.log(`
Add these environment variables (DATABASE_URL comes from Neon):

ADMIN_PASSWORD_HASH=scrypt:${salt.toString("base64url")}:${hash.toString("base64url")}
ENCRYPTION_KEY=${randomBytes(32).toString("base64")}
CRON_SECRET=${randomBytes(24).toString("base64url")}

Keep ENCRYPTION_KEY safe: changing it makes the stored X cookies unreadable
(you would just paste them again).
`);
