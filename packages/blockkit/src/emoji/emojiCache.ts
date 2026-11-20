import { createSignal } from "solid-js";

let emojiUrls: Record<string, string | null> = {};
let emojiAliasesToBuiltinNames: Record<string, string> = {};
const [loadState, setLoadState] = createSignal<"idle" | "loading" | "loaded" | "error">("idle");

let emojiLoadPromise: Promise<void> | null = null;

async function fetchAllEmoji() {
  const res = await fetch("/api/emoji");
  if (!res.ok) throw new Error(`Emoji list failed (${res.status})`);
  const data: {
    names: string[];
    aliasesToBuiltinNames: Record<string, string>;
  } = await res.json();
  const urls: Record<string, string> = {};
  for (const name of data.names) urls[name] = `/api/emoji/${encodeURIComponent(name)}`;
  return { aliasesToBuiltinNames: data.aliasesToBuiltinNames, urls };
}

export function loadCustomEmoji(): Promise<void> {
  if (!emojiLoadPromise) {
    setLoadState("loading");
    emojiLoadPromise = fetchAllEmoji()
      .then((data) => {
        emojiUrls = data.urls;
        emojiAliasesToBuiltinNames = data.aliasesToBuiltinNames;
        setLoadState("loaded");
      })
      .catch(() => {
        emojiLoadPromise = null;
        setLoadState("error");
      });
  }
  return emojiLoadPromise;
}

export function invalidateCustomEmoji(): void {
  emojiLoadPromise = null;
  setLoadState("idle");
}

export function emojiUrl(name: string): string | null | undefined {
  if (name in emojiUrls) return emojiUrls[name];
  return loadState() === "loaded" ? null : undefined;
}

export function emojiAliasTarget(name: string): string | undefined {
  if (name in emojiAliasesToBuiltinNames) return emojiAliasesToBuiltinNames[name];
  void loadState();
}

export function customEmojiNames(): string[] {
  void loadState();
  return Object.keys(emojiUrls);
}

export function isEmojiLoaded(): boolean {
  return loadState() === "loaded";
}

export function isEmojiLoading(): boolean {
  return loadState() === "loading";
}

export function hasEmojiLoadError(): boolean {
  return loadState() === "error";
}
