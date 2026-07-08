import { createStore } from "solid-js/store";
import { fetchAllEmoji } from "./slackApi";

// One bulk fetch instead of a network round-trip per unique emoji name — cheaper
// and means reactions/messages never show a loading flicker after the first paint.
const [emojiUrls, setEmojiUrls] = createStore<Record<string, string | null>>({});
const [loaded, setLoaded] = createStore({ value: false });

fetchAllEmoji()
  .then((map) => {
    setEmojiUrls(map);
    setLoaded("value", true);
  })
  .catch(() => setLoaded("value", true));

export function emojiUrl(name: string): string | null | undefined {
  if (name in emojiUrls) return emojiUrls[name];
  return loaded.value ? null : undefined;
}

export function customEmojiNames(): string[] {
  return Object.keys(emojiUrls);
}

export function isEmojiLoaded(): boolean {
  return loaded.value;
}
