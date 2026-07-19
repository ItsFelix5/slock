import {
  type ContextBlock,
  fileProxyUrl,
  type ImageElement,
  type TextObject,
} from "@slock/slack-api";
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
              src={fileProxyUrl(
                (el as ImageElement).image_url ?? (el as ImageElement).slack_file?.url ?? "",
              )}
            />
          </Show>
        )}
      </For>
    </div>
  );
}
