import { createFakeEnv } from "@slock/core/testing";
import { ch, stamp } from "@slock/slack/testing";
import type { Block } from "@slock/types";
import { createRoot, createSignal, flush } from "solid-js";
import { createComposerDraftState } from "../../../src/drafts/client/composerDrafts";
import { createDraftStore } from "../../../src/drafts/client/draftStore";

export const blocks = (value: string): Block[] =>
  value
    ? [
        {
          elements: [{ elements: [{ text: value, type: "text" }], type: "rich_text_section" }],
          type: "rich_text",
        },
      ]
    : [];

export const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

export function mountComposer(initialKey: string) {
  const env = createFakeEnv();
  const store = createDraftStore();
  const [key, setKeySignal] = createSignal(initialKey);
  const [current, setCurrentSignal] = createSignal<Block[]>([]);
  let dispose = () => {};
  const state = createRoot((stop) => {
    dispose = stop;
    return createComposerDraftState(store, env, {
      blocks: current,
      channelId: () => ch(key().split(":thread:")[0] ?? ""),
      loadIntoEditor: (loaded) => setCurrentSignal(loaded),
      ready: () => true,
      threadTs: () => {
        const ts = key().split(":thread:")[1];
        return ts ? stamp(ts) : undefined;
      },
    });
  });
  return {
    current,
    dispose: () => {
      dispose();
      store.dispose();
    },
    env,
    setCurrent: (value: Block[]) => {
      setCurrentSignal(value);
      flush();
    },
    setKey: (value: string) => {
      setKeySignal(value);
      flush();
    },
    state,
    store,
  };
}

export async function mountReady(key: string) {
  const composer = mountComposer(key);
  await composer.store.hydrate();
  await settle();
  flush();
  return composer;
}
