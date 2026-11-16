import { describe, expect, test } from "bun:test";
import { mintToken, readToken, TOKEN_LIFETIME_MS, TOKEN_PREFIX } from "../src/token";

const who = { team: "T1", user: "U1" };

describe("relay tokens", () => {
  test("a minted token reads back as the same identity", () => {
    expect(readToken("secret", mintToken("secret", who))).toEqual(who);
  });

  test("a token signed with another secret is rejected", () => {
    expect(readToken("other", mintToken("secret", who))).toBeUndefined();
  });

  test("a token whose payload was swapped is rejected", () => {
    const forged = mintToken("secret", { team: "T1", user: "U2" });
    const [, signature] = mintToken("secret", who).split(".");
    const [payload] = forged.slice(TOKEN_PREFIX.length).split(".");
    expect(readToken("secret", `${TOKEN_PREFIX}${payload}.${signature}`)).toBeUndefined();
  });

  test("an expired token is rejected", () => {
    const now = 1_000_000;
    const token = mintToken("secret", who, now);
    expect(readToken("secret", token, now + TOKEN_LIFETIME_MS - 1)).toEqual(who);
    expect(readToken("secret", token, now + TOKEN_LIFETIME_MS)).toBeUndefined();
  });

  test("garbage is rejected without throwing", () => {
    for (const token of ["", "nope", `${TOKEN_PREFIX}`, `${TOKEN_PREFIX}a.b`, `${TOKEN_PREFIX}.`]) {
      expect(readToken("secret", token)).toBeUndefined();
    }
  });

  test("tokens carry the prefix so they are recognisable", () => {
    expect(mintToken("secret", who).startsWith(TOKEN_PREFIX)).toBe(true);
  });
});
