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
const [loadState, setLoadState] = createStore<{
  value: "idle" | "loading" | "loaded" | "error";
}>({ value: "idle" });

let emojiLoadPromise: Promise<void> | null = null;

// `emoji.list` can be several megabytes for workspaces with many custom emoji.
// Start it shortly after the initial page load so custom emoji in messages are
// available without competing with bootstrap, while emoji interactions can
// still request it immediately.
export function loadCustomEmoji(): Promise<void> {
  if (!emojiLoadPromise) {
    setLoadState("value", "loading");
    emojiLoadPromise = fetchAllEmoji()
      .then((map) => {
        emojiUrls = map;
        setLoadState("value", "loaded");
      })
      .catch(() => {
        emojiLoadPromise = null;
        setLoadState("value", "error");
      });
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
  return loadState.value === "loaded" ? null : undefined;
}

export function customEmojiNames(): string[] {
  // biome-ignore lint/suspicious/noUnusedExpressions: This reactive read invalidates consumers when the plain bulk map is replaced.
  loadState.value;
  return Object.keys(emojiUrls);
}

export function isEmojiLoaded(): boolean {
  return loadState.value === "loaded";
}

export function isEmojiLoading(): boolean {
  return loadState.value === "loading";
}

export function hasEmojiLoadError(): boolean {
  return loadState.value === "error";
}
