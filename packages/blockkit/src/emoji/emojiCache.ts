import { fetchAllEmoji } from "@slock/types";
import { createRoot } from "solid-js";
import { createStore } from "solid-js/store";

let emojiUrls: Record<string, string | null> = {};
let emojiAliasesToBuiltinNames: Record<string, string> = {};
const [loadState, setLoadState] = createRoot(() =>
  createStore<{ value: "idle" | "loading" | "loaded" | "error" }>({ value: "idle" }),
);

let emojiLoadPromise: Promise<void> | null = null;

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
