import { apiGet } from "./server";

let emojiMapPromise: Promise<Record<string, string>> | null = null;

export function fetchAllEmoji(): Promise<Record<string, string>> {
  if (!emojiMapPromise) {
    emojiMapPromise = fetch("/api/emoji")
      .then((res) => {
        if (!res.ok) throw new Error(`Emoji list failed (${res.status})`);
        return res.text();
      })
      .then((text) => {
        const names = text ? text.split("\n") : [];
        const resolved: Record<string, string> = {};
        for (const name of names) {
          resolved[name] = `/api/emoji/${encodeURIComponent(name)}`;
        }
        return resolved;
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
