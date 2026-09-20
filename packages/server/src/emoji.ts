import type { Credentials } from "./auth.ts";
import { compressedResponse } from "./http/compressedResponse.ts";

const EMOJI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const EMOJI_LIST_HEADERS = {
  "cache-control": "private, max-age=86400",
  "content-type": "application/json; charset=utf-8",
  vary: "Cookie",
};

type SlackFetcher = (
  method: string,
  params: Record<string, string>,
  creds: Credentials | null,
) => Promise<any>;

type EmojiCacheData = {
  names: string[];
  urls: Record<string, string>;
  aliasesToBuiltinNames: Record<string, string>;
};
type EmojiCacheEntry = {
  data?: EmojiCacheData;
  expiresAt: number;
  promise?: Promise<EmojiCacheData>;
};

const emojiCache = new Map<string, EmojiCacheEntry>();

function emojiCacheKey(creds: Credentials): string {
  return `${creds.domain}|${creds.route}`;
}

export function invalidateEmojiCache(creds: Credentials): void {
  emojiCache.delete(emojiCacheKey(creds));
}

function resolveEmojiChain(
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

function normalizeEmojiList(raw: Record<string, string>): EmojiCacheData {
  const names: string[] = [];
  const urls: Record<string, string> = {};
  const aliasesToBuiltinNames: Record<string, string> = {};
  for (const name of Object.keys(raw)) {
    const { url, endName } = resolveEmojiChain(raw, name);
    if (url) {
      names.push(name);
      urls[name] = url;
    } else if (endName !== name) {
      aliasesToBuiltinNames[name] = endName;
    }
  }
  return { aliasesToBuiltinNames, names, urls };
}

function loadEmojiData(
  creds: Credentials | null,
  callSlack: SlackFetcher,
): Promise<EmojiCacheData> {
  if (!creds) return Promise.resolve({ aliasesToBuiltinNames: {}, names: [], urls: {} });
  const key = emojiCacheKey(creds);
  const now = Date.now();
  const cached = emojiCache.get(key);
  if (cached?.data && cached.expiresAt > now) return Promise.resolve(cached.data);
  if (cached?.promise) return cached.promise;

  const promise = callSlack("emoji.list", {}, creds)
    .then((data) => normalizeEmojiList(data.ok ? (data.emoji ?? {}) : {}))
    .then((data) => {
      emojiCache.set(key, { data, expiresAt: Date.now() + EMOJI_CACHE_TTL_MS });
      return data;
    })
    .catch((err) => {
      emojiCache.delete(key);
      throw err;
    });
  emojiCache.set(key, { data: cached?.data, expiresAt: cached?.expiresAt ?? 0, promise });
  return promise;
}

export async function emojiListResponse(
  creds: Credentials | null,
  callSlack: SlackFetcher,
  acceptEncoding: string | null,
): Promise<Response> {
  const data = await loadEmojiData(creds, callSlack);
  const body = JSON.stringify({
    aliasesToBuiltinNames: data.aliasesToBuiltinNames,
    names: data.names,
  });
  return compressedResponse(body, EMOJI_LIST_HEADERS, acceptEncoding);
}

export async function emojiImageUrl(
  name: string | null,
  creds: Credentials | null,
  callSlack: SlackFetcher,
): Promise<string | null> {
  if (!name) return null;
  const data = await loadEmojiData(creds, callSlack);
  return data.urls[name] ?? null;
}
