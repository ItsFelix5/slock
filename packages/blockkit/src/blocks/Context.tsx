import {
  type ContextBlock,
  type ImageElement,
  resolveMediaUrl,
  type TextObject,
} from "@slock/types";
import { For, Show } from "solid-js";
import BkText from "../BkText";

export default function Context(props: { block: ContextBlock }) {
  return (
    <div class="bk-context">
      <For each={props.block.elements}>
        {(el) => (
          <Show
            fallback={<BkText class="bk-context-text" text={el as TextObject} />}
            when={el.type === "image"}
          >
            <img
              alt={(el as ImageElement).alt_text ?? ""}
              class="bk-context-image"
              src={resolveMediaUrl(
                (el as ImageElement).image_url ?? (el as ImageElement).slack_file?.url ?? "",
              )}
            />
          </Show>
        )}
      </For>
    </div>
  );
}
