import { service } from "@slock/core/services";
import type { Credentials } from "@slock/plugins/slack/server/api/auth";
import { callSlack } from "@slock/plugins/slack/server/api/slackClient";

declare module "@slock/core/types" {
  interface Services {
    "emoji.server": ReturnType<typeof createEmojiCache>;
  }
}

const env = service("env");

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
    if (cached?.data && cached.expiresAt > env.now()) return Promise.resolve(cached.data);
    if (cached?.promise) return cached.promise;
    const current = () => entries.get(key)?.promise === promise;
    const promise: Promise<EmojiData> = callSlack<{ emoji?: Record<string, string> }>(
      "emoji.list",
      {},
      creds,
    )
      .then((reply) => {
        if (!reply.ok) throw new Error(`emoji.list failed: ${reply.error}`);
        const data = normalize(reply.emoji ?? {});
        if (current()) entries.set(key, { data, expiresAt: env.now() + EMOJI_CACHE_TTL_MS });
        return data;
      })
      .catch((error) => {
        if (current()) entries.delete(key);
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
