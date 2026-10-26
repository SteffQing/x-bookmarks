export interface XCredentials {
  authToken: string;
  ct0: string;
}

function pick(input: string, name: string) {
  // Matches `name=value` (Cookie header), `name\tvalue` (DevTools table rows),
  // `"name": "value"` (JSON) and `name: value`.
  const re = new RegExp(`(?:^|[\\s;,{"'])${name}["']?\\s*[=:\\t]\\s*["']?([A-Za-z0-9%_-]+)`, "m");
  return re.exec(input)?.[1];
}

/**
 * Extracts `auth_token` and `ct0` from whatever the user pasted: a raw `cookie:` request header,
 * rows copied from DevTools' cookie table, or a JSON cookie export.
 */
export function parseCredentials(raw: string): XCredentials | null {
  const input = raw.trim();
  if (!input) return null;

  try {
    const json: unknown = JSON.parse(input);
    if (Array.isArray(json)) {
      const find = (n: string) =>
        json.find((c): c is { name: string; value: string } => c?.name === n && typeof c?.value === "string")?.value;
      const authToken = find("auth_token");
      const ct0 = find("ct0");
      if (authToken && ct0) return { authToken, ct0 };
    }
  } catch {
    // Not JSON; fall through to text matching.
  }

  const authToken = pick(input, "auth_token");
  const ct0 = pick(input, "ct0");
  return authToken && ct0 ? { authToken, ct0 } : null;
}
