import { createEmojiSource, type EmojiList } from "@slock/blockkit";
import { service } from "@slock/core/solid";

const env = service("env");

async function fetchEmojiList(): Promise<EmojiList> {
  const res = await env.fetch("/api/emoji");
  if (!res.ok) throw new Error(`Emoji list failed (${res.status})`);
  const data: { names: string[]; aliasesToBuiltinNames: Record<string, string> } = await res.json();
  return {
    aliases: new Map(Object.entries(data.aliasesToBuiltinNames)),
    urls: new Map(data.names.map((name) => [name, `/api/emoji/${encodeURIComponent(name)}`])),
  };
}

export const createCustomEmojiSource = () => createEmojiSource(fetchEmojiList);
