import { type BlockActionContext, BlockKit } from "@slock/blockkit";
import type { Block } from "@slock/types";
import { Clamp } from "@slock/ui";
import { For, Show } from "solid-js";

export const ATTACHMENT_LINES = 12;

function hasMedia(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  if ("type" in value && (value.type === "image" || value.type === "video")) return true;
  return Object.values(value).some(hasMedia);
}

function mediaRuns(blocks: Block[]) {
  const runs: { media: boolean; blocks: Block[] }[] = [];
  for (const block of blocks) {
    const media = hasMedia(block);
    const last = runs.at(-1);
    if (last?.media === media) last.blocks.push(block);
    else runs.push({ blocks: [block], media });
  }
  return runs;
}

export default function AttachmentBlocks(props: { blocks: Block[]; context?: BlockActionContext }) {
  return (
    <div class="attachment-text flex-col gap-sm">
      <For each={mediaRuns(props.blocks)}>
        {(run) => (
          <Show
            fallback={
              <Clamp lines={ATTACHMENT_LINES}>
                <BlockKit blocks={run.blocks} context={props.context} />
              </Clamp>
            }
            when={run.media}
          >
            <BlockKit blocks={run.blocks} context={props.context} />
          </Show>
        )}
      </For>
    </div>
  );
}
