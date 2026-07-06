import { createStore } from 'solid-js/store';

const [emojiUrls, setEmojiUrls] = createStore<Record<string, string | null>>({});
const pending = new Set<string>();

export function emojiUrl(name: string): string | null | undefined {
  if (name in emojiUrls) return emojiUrls[name];
  if (!pending.has(name)) {
    pending.add(name);
    fetch(`/api/emoji?name=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((data) => setEmojiUrls(name, data.url ?? null))
      .catch(() => setEmojiUrls(name, null));
  }
  return undefined;
}
