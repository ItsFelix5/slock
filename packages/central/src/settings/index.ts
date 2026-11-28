import type { Authenticate } from "../auth";
import type { Handler } from "../server";
import type { SettingsStore } from "./store";

const MAX_VALUE_BYTES = 64 * 1024;
const KEY = /^[\w.-]{1,64}$/;
const ROUTE = /^\/settings(?:\/([^/]+))?$/;

const fail = (error: string, status: number) => Response.json({ error }, { status });

function isJson(raw: string) {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

async function readValue(req: Request): Promise<string | undefined> {
  const raw = await req.text();
  const tooBig = new TextEncoder().encode(raw).length > MAX_VALUE_BYTES;
  return tooBig || !isJson(raw) ? undefined : raw;
}

/**
 * Slock's own per-user settings, one JSON value per key.
 * GET /settings, PUT /settings/:key (JSON body) and DELETE /settings/:key.
 */
export function settings(store: SettingsStore, authenticate: Authenticate): Handler {
  return async (req, url) => {
    const match = ROUTE.exec(url.pathname);
    if (!match) return;
    const who = await authenticate(req);
    if (!who) return fail("unauthorized", 401);

    const key = match[1] === undefined ? undefined : decodeKey(match[1]);
    if (key === undefined) {
      if (req.method !== "GET") return fail("method_not_allowed", 405);
      return Response.json({ settings: store.all(who) });
    }
    if (!KEY.test(key)) return fail("invalid_key", 400);

    if (req.method === "DELETE") {
      store.remove(who, key);
      return new Response(null, { status: 204 });
    }
    if (req.method !== "PUT") return fail("method_not_allowed", 405);
    const value = await readValue(req);
    if (value === undefined) return fail("invalid_value", 400);
    if (store.set(who, key, value) === "too_many") return fail("too_many_settings", 409);
    return new Response(null, { status: 204 });
  };
}

/** A key that cannot be decoded is returned empty so it fails the key check. */
function decodeKey(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return "";
  }
}
