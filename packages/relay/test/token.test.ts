import { describe, expect, test } from "bun:test";
import {
  claim,
  handOff,
  mintToken,
  readToken,
  TOKEN_LIFETIME_MS,
  TOKEN_PREFIX,
} from "../src/token";

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

describe("handing a token to whoever asked for it", () => {
  const nonce = "n-0123456789abcdef";

  test("is claimed once by the nonce it was handed out under", async () => {
    handOff(nonce, "secret-token");
    expect(await claim(nonce)).toBe("secret-token");
    expect(await claim(nonce, 0)).toBeUndefined();
  });

  test("waits for a token that has not arrived yet", async () => {
    const claiming = claim("n-late-0123456789ab", 1000);
    setTimeout(() => handOff("n-late-0123456789ab", "late-token"), 150);
    expect(await claiming).toBe("late-token");
  });

  test("gives nothing for a nonce nobody used", async () => {
    expect(await claim("n-unknown-0123456789", 0)).toBeUndefined();
  });
});
