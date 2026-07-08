import type { ContextBlock } from "@slock/slack-api";
import { For, Show } from "solid-js";
import BkText from "../BkText";

export default function Context(props: { block: ContextBlock }) {
  return (
    <div class="bk-context">
      <For each={props.block.elements}>
        {(el) => (
          <Show
            when={"type" in el && el.type === "image"}
            fallback={<BkText text={el as any} class="bk-context-text" />}
          >
            <img
              class="bk-context-image"
              src={(el as any).image_url ?? (el as any).slack_file?.url}
              alt={(el as any).alt_text ?? ""}
            />
          </Show>
        )}
      </For>
    </div>
  );
}
