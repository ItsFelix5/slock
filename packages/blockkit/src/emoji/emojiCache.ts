import { createStore } from "solid-js/store";

let emojiUrls: Record<string, string | null> = {};
let emojiAliasesToBuiltinNames: Record<string, string> = {};
const [loadState, setLoadState] = createStore<{ value: "idle" | "loading" | "loaded" | "error" }>({
  value: "idle",
});

let emojiLoadPromise: Promise<void> | null = null;

async function fetchAllEmoji() {
  const res = await fetch("/api/emoji");
  if (!res.ok) throw new Error(`Emoji list failed (${res.status})`);
  const data: { names: string[]; aliasesToBuiltinNames: Record<string, string> } = await res.json();
  const urls: Record<string, string> = {};
  for (const name of data.names) urls[name] = `/api/emoji/${encodeURIComponent(name)}`;
  return { aliasesToBuiltinNames: data.aliasesToBuiltinNames, urls };
}

export function loadCustomEmoji(): Promise<void> {
  if (!emojiLoadPromise) {
    setLoadState("value", "loading");
    emojiLoadPromise = fetchAllEmoji()
      .then((data) => {
        emojiUrls = data.urls;
        emojiAliasesToBuiltinNames = data.aliasesToBuiltinNames;
        setLoadState("value", "loaded");
      })
      .catch(() => {
        emojiLoadPromise = null;
        setLoadState("value", "error");
      });
  }
  return emojiLoadPromise;
}

export function invalidateCustomEmoji(): void {
  emojiLoadPromise = null;
  setLoadState("value", "idle");
}

export function emojiUrl(name: string): string | null | undefined {
  if (name in emojiUrls) return emojiUrls[name];
  return loadState.value === "loaded" ? null : undefined;
}

export function emojiAliasTarget(name: string): string | undefined {
  if (name in emojiAliasesToBuiltinNames) return emojiAliasesToBuiltinNames[name];
  void loadState.value;
}

export function customEmojiNames(): string[] {
  void loadState.value;
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
