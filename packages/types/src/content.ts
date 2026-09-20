import { apiGet } from "./server";

export interface EmojiListData {
  urls: Record<string, string>;
  aliasesToBuiltinNames: Record<string, string>;
}

let emojiMapPromise: Promise<EmojiListData> | null = null;

export function fetchAllEmoji(): Promise<EmojiListData> {
  if (!emojiMapPromise) {
    emojiMapPromise = fetch("/api/emoji")
      .then((res) => {
        if (!res.ok) throw new Error(`Emoji list failed (${res.status})`);
        return res.json();
      })
      .then((data: { names: string[]; aliasesToBuiltinNames: Record<string, string> }) => {
        const urls: Record<string, string> = {};
        for (const name of data.names) urls[name] = `/api/emoji/${encodeURIComponent(name)}`;
        return { aliasesToBuiltinNames: data.aliasesToBuiltinNames, urls };
      })
      .catch((error) => {
        emojiMapPromise = null;
        throw error;
      });
  }
  return emojiMapPromise;
}

export async function fetchSlashCommands(): Promise<
  { name: string; desc: string; icon: string | null }[]
> {
  const data = await apiGet("/api/commands");
  if (!data.ok) throw new Error(data.error ?? "fetching commands failed");
  return data.commands ?? [];
}
