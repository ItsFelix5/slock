import type { Block } from "@slock/types";
import { createRoot, createSignal, flush } from "solid-js";
import { createComposerDraftState } from "../../../../packages/plugins/src/drafts/client/composerDrafts";
import { createDraftStore } from "../../../../packages/plugins/src/drafts/client/draftStore";
import { createFakeEnv } from "../../../support/core";
import { ch, stamp } from "../../../support/slack";

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
        const [, ts] = key().split(":thread:");
        return ts ? stamp(ts) : undefined;
      },
    });
  });
  return {
    current,
    dispose: () => dispose(),
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
