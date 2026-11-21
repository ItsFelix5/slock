import { createContext, createSignal, useContext } from "solid-js";
import { createStillEmojiCache, decodeStillEmoji, type StillEmoji } from "./stillEmoji";

export interface EmojiList {
  aliases: ReadonlyMap<string, string>;
  urls: ReadonlyMap<string, string>;
}

export interface EmojiSource {
  aliasTarget(name: string): string | undefined;
  failed(): boolean;
  invalidate(): void;
  load(): Promise<void>;
  loading(): boolean;
  names(): string[];
  still(url: string): Promise<StillEmoji>;
  url(name: string): string | null | undefined;
}

const emptyList: EmojiList = { aliases: new Map(), urls: new Map() };

export function createEmojiSource(loadList: () => Promise<EmojiList>): EmojiSource {
  const [state, setState] = createSignal<"idle" | "loading" | "loaded" | "error">("idle", {
    ownedWrite: true,
  });
  const [list, setList] = createSignal(emptyList);
  const still = createStillEmojiCache();
  let pending: Promise<void> | undefined;

  function load() {
    if (pending) return pending;
    setState("loading");
    const current: Promise<void> = loadList().then(
      (next) => {
        if (pending !== current) return;
        setList(next);
        setState("loaded");
      },
      () => {
        if (pending !== current) return;
        pending = undefined;
        setState("error");
      },
    );
    pending = current;
    return current;
  }

  return {
    aliasTarget: (name) => list().aliases.get(name),
    failed: () => state() === "error",
    invalidate() {
      pending = undefined;
      setState("idle");
    },
    load,
    loading: () => state() === "loading",
    names: () => [...list().urls.keys()],
    still,
    url(name) {
      const url = list().urls.get(name);
      if (url !== undefined) return url;
      return state() === "loaded" ? null : undefined;
    },
  };
}

const inertEmojiSource: EmojiSource = {
  aliasTarget: () => undefined,
  failed: () => false,
  invalidate: () => {},
  load: () => Promise.resolve(),
  loading: () => false,
  names: () => [],
  still: decodeStillEmoji,
  url: () => null,
};

export const EmojiSourceContext = createContext<EmojiSource>(inertEmojiSource);

export function useEmojiSource(): EmojiSource {
  return useContext(EmojiSourceContext);
}
