import { type Credentials, compressedResponse } from "./relay-core.ts";

const EMOJI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const EMOJI_LIST_HEADERS = {
  "access-control-allow-origin": "*",
  "cache-control": "private, max-age=86400",
  "content-type": "text/plain; charset=utf-8",
  vary: "Cookie",
};

type SlackCaller = (
  method: string,
  params: Record<string, string>,
  creds: Credentials | null,
) => Promise<any>;

type EmojiCacheData = {
  names: string[];
  urls: Record<string, string>;
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

function resolveEmojiUrl(raw: Record<string, string>, name: string): string | null {
  let value = raw[name];
  const seen = new Set<string>();
  while (typeof value === "string" && value.startsWith("alias:")) {
    const alias = value.slice("alias:".length);
    if (seen.has(alias)) return null;
    seen.add(alias);
    value = raw[alias];
  }
  return typeof value === "string" && value.startsWith("http") ? value : null;
}

function normalizeEmojiList(raw: Record<string, string>): EmojiCacheData {
  const names: string[] = [];
  const urls: Record<string, string> = {};
  for (const name of Object.keys(raw)) {
    const url = resolveEmojiUrl(raw, name);
    if (!url) continue;
    names.push(name);
    urls[name] = url;
  }
  return { names, urls };
}

function loadEmojiData(creds: Credentials | null, callSlack: SlackCaller): Promise<EmojiCacheData> {
  if (!creds) return Promise.resolve({ names: [], urls: {} });
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
  callSlack: SlackCaller,
  acceptEncoding: string | null,
): Promise<Response> {
  const data = await loadEmojiData(creds, callSlack);
  return compressedResponse(data.names.join("\n"), EMOJI_LIST_HEADERS, acceptEncoding);
}

export async function emojiImageUrl(
  name: string | null,
  creds: Credentials | null,
  callSlack: SlackCaller,
): Promise<string | null> {
  if (!name) return null;
  const data = await loadEmojiData(creds, callSlack);
  return data.urls[name] ?? null;
}
