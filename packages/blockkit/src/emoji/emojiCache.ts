import { fetchAllEmoji } from "@slock/slack-api";
import { createStore } from "solid-js/store";

let emojiUrls: Record<string, string | null> = {};
const [loadState, setLoadState] = createStore<{
  value: "idle" | "loading" | "loaded" | "error";
}>({ value: "idle" });

let emojiLoadPromise: Promise<void> | null = null;

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

export function emojiUrl(name: string): string | null | undefined {
  if (name in emojiUrls) return emojiUrls[name];
  return loadState.value === "loaded" ? null : undefined;
}

export function customEmojiNames(): string[] {
  void loadState.value; // reactive read: subscribes callers to reloads even though only the keys are used
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
