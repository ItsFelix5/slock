import { timingSafeEqual } from "node:crypto";

export type Identity = { team: string; user: string };

export const TOKEN_PREFIX = "slockrelay_";
export const TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

const NONCE = /^[\w-]{16,128}$/;
const HANDOFF_MS = 60_000;
const CLAIM_POLL_MS = 100;
const handoffs = new Map<string, string>();

function sign(secret: string, payload: string) {
  return new Bun.CryptoHasher("sha256", secret)
    .update(`relay-token:${payload}`)
    .digest("base64url");
}

export function mintToken(secret: string, { team, user }: Identity, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify([team, user, now + TOKEN_LIFETIME_MS])).toString(
    "base64url",
  );
  return `${TOKEN_PREFIX}${payload}.${sign(secret, payload)}`;
}

function readClaims(payload: string): [string, string, number] | undefined {
  try {
    const [team, user, expires] = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof team === "string" && typeof user === "string" && typeof expires === "number") {
      return [team, user, expires];
    }
  } catch {}
}

export function readToken(secret: string, token: string, now = Date.now()): Identity | undefined {
  if (!token.startsWith(TOKEN_PREFIX)) return;
  const [payload = "", signature = ""] = token.slice(TOKEN_PREFIX.length).split(".");
  const expected = Buffer.from(sign(secret, payload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return;
  const claims = readClaims(payload);
  if (claims && claims[2] > now) return { team: claims[0], user: claims[1] };
}

export function isNonce(value: unknown): value is string {
  return typeof value === "string" && NONCE.test(value);
}

export function handOff(nonce: string, token: string) {
  handoffs.set(nonce, token);
  setTimeout(() => handoffs.delete(nonce), HANDOFF_MS).unref();
}

export async function claim(nonce: string, waitMs = 5000) {
  for (let waited = 0; ; waited += CLAIM_POLL_MS) {
    const token = handoffs.get(nonce);
    if (token) {
      handoffs.delete(nonce);
      return token;
    }
    if (waited >= waitMs) return;
    await Bun.sleep(CLAIM_POLL_MS);
  }
}
