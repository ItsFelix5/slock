import { fetchAllEmoji } from "@slock/slack-api";
import { createStore } from "solid-js/store";

// One bulk fetch instead of a network round-trip per unique emoji name — cheaper
// and means reactions/messages never show a loading flicker after the first paint.
// Plain object, not a Solid store: workspaces can have tens of thousands of
// custom emoji, and this map is only ever written once in bulk, so per-key
// fine-grained reactivity would just mean Solid allocating a signal for every
// single name the moment anything iterates the full list (e.g. the emoji
// picker's search index) — `loaded` below is the only reactive signal needed.
let emojiUrls: Record<string, string | null> = {};
const [loaded, setLoaded] = createStore({ value: false });

let emojiLoadPromise: Promise<void> | null = null;

// `emoji.list` can be several megabytes for workspaces with many custom emoji.
// Start it shortly after the initial page load so custom emoji in messages are
// available without competing with bootstrap, while emoji interactions can
// still request it immediately.
export function loadCustomEmoji(): Promise<void> {
  if (!emojiLoadPromise) {
    emojiLoadPromise = fetchAllEmoji()
      .then((map) => {
        emojiUrls = map;
      })
      .catch(() => { })
      .finally(() => setLoaded("value", true));
  }
  return emojiLoadPromise;
}

function prefetchCustomEmoji() {
  // Give the browser a small window to paint the app before this large
  // response starts competing for network and parsing time.
  window.setTimeout(() => void loadCustomEmoji(), 250);
}

if (document.readyState === "complete") prefetchCustomEmoji();
else window.addEventListener("load", prefetchCustomEmoji, { once: true });

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
