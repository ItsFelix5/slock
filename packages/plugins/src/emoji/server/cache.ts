import type { Credentials } from "../../slack/server/api/auth";
import { callSlack } from "../../slack/server/api/slackClient";

const EMOJI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type EmojiData = {
  names: string[];
  urls: Record<string, string>;
  aliasesToBuiltinNames: Record<string, string>;
};

type CacheEntry = { data?: EmojiData; expiresAt: number; promise?: Promise<EmojiData> };

function resolveChain(
  raw: Record<string, string>,
  name: string,
): { url: string | null; endName: string } {
  let endName = name;
  let value = raw[endName];
  const seen = new Set<string>();
  while (typeof value === "string" && value.startsWith("alias:")) {
    endName = value.slice("alias:".length);
    if (seen.has(endName)) return { endName, url: null };
    seen.add(endName);
    value = raw[endName];
  }
  const url = typeof value === "string" && value.startsWith("http") ? value : null;
  return { endName, url };
}

function normalize(raw: Record<string, string>): EmojiData {
  const names: string[] = [];
  const urls: Record<string, string> = {};
  const aliasesToBuiltinNames: Record<string, string> = {};
  for (const name of Object.keys(raw)) {
    const { url, endName } = resolveChain(raw, name);
    if (url) {
      names.push(name);
      urls[name] = url;
    } else if (endName !== name) {
      aliasesToBuiltinNames[name] = endName;
    }
  }
  return { aliasesToBuiltinNames, names, urls };
}

export function createEmojiCache() {
  const entries = new Map<string, CacheEntry>();
  const keyFor = (creds: Credentials) => `${creds.domain}|${creds.route}`;

  function load(creds: Credentials | null): Promise<EmojiData> {
    if (!creds) return Promise.resolve({ aliasesToBuiltinNames: {}, names: [], urls: {} });
    const key = keyFor(creds);
    const cached = entries.get(key);
    if (cached?.data && cached.expiresAt > Date.now()) return Promise.resolve(cached.data);
    if (cached?.promise) return cached.promise;
    const promise = callSlack<{ emoji?: Record<string, string> }>("emoji.list", {}, creds)
      .then((reply) => normalize(reply.ok ? (reply.emoji ?? {}) : {}))
      .then((data) => {
        entries.set(key, { data, expiresAt: Date.now() + EMOJI_CACHE_TTL_MS });
        return data;
      })
      .catch((error) => {
        entries.delete(key);
        throw error;
      });
    entries.set(key, { data: cached?.data, expiresAt: cached?.expiresAt ?? 0, promise });
    return promise;
  }

  return {
    async imageUrl(name: string | null, creds: Credentials | null): Promise<string | null> {
      if (!name) return null;
      return (await load(creds)).urls[name] ?? null;
    },
    invalidate(creds: Credentials) {
      entries.delete(keyFor(creds));
    },
    async list(creds: Credentials | null) {
      const { aliasesToBuiltinNames, names } = await load(creds);
      return { aliasesToBuiltinNames, names };
    },
  };
}
