import type { Block } from "@slock/types";
import { createRoot, createSignal } from "solid-js";
import { createComposerDraftState } from "../../../src/drafts/client/composerDrafts";
import { hydrateDrafts } from "../../../src/drafts/client/draftStore";

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
  const [key, setKey] = createSignal(initialKey);
  const [current, setCurrent] = createSignal<Block[]>([]);
  let dispose = () => {};
  const state = createRoot((stop) => {
    dispose = stop;
    return createComposerDraftState({
      blocks: current,
      channelId: () => key().split(":thread:")[0],
      editing: () => false,
      key,
      loadIntoEditor: (loaded) => setCurrent(loaded),
      ready: () => true,
      resetPreviews: () => {},
      threadTs: () => key().split(":thread:")[1],
    });
  });
  return { current, dispose: () => dispose(), setCurrent, setKey, state };
}

export async function mountReady(key: string) {
  const composer = mountComposer(key);
  await hydrateDrafts();
  await settle();
  return composer;
}
