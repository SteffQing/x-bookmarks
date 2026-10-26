import { describe, expect, it } from "vitest";
import { parseCredentials } from "./cookies";

const AUTH = "0123456789abcdef0123456789abcdef01234567";
const CT0 = "fedcba9876543210fedcba9876543210";

describe("parseCredentials", () => {
  it("reads a raw cookie header", () => {
    expect(parseCredentials(`cookie: guest_id=v1%3A1; auth_token=${AUTH}; lang=en; ct0=${CT0}; twid=u%3D1`)).toEqual({
      authToken: AUTH,
      ct0: CT0,
    });
  });

  it("reads rows copied from the DevTools cookie table", () => {
    const rows = `auth_token\t${AUTH}\t.x.com\t/\t2026-12-01\nct0\t${CT0}\t.x.com\t/\t2026-12-01`;
    expect(parseCredentials(rows)).toEqual({ authToken: AUTH, ct0: CT0 });
  });

  it("reads JSON exports", () => {
    expect(parseCredentials(JSON.stringify([{ name: "ct0", value: CT0 }, { name: "auth_token", value: AUTH }]))).toEqual({
      authToken: AUTH,
      ct0: CT0,
    });
    expect(parseCredentials(JSON.stringify({ auth_token: AUTH, ct0: CT0 }))).toEqual({ authToken: AUTH, ct0: CT0 });
  });

  it("does not confuse similarly named cookies", () => {
    expect(parseCredentials(`kdt=zzz; auth_token=${AUTH}; ct0=${CT0}`)?.authToken).toBe(AUTH);
    expect(parseCredentials(`auth_token=${AUTH}`)).toBeNull();
    expect(parseCredentials("")).toBeNull();
  });
});
