import { type ContextBlock, fileProxyUrl } from "@slock/slack-api";
import { For, Show } from "solid-js";
import BkText from "../BkText";

export default function Context(props: { block: ContextBlock }) {
  return (
    <div class="bk-context">
      <For each={props.block.elements}>
        {(el) => (
          <Show
            fallback={<BkText class="bk-context-text" text={el as any} />}
            when={"type" in el && el.type === "image"}
          >
            <img
              alt={(el as any).alt_text ?? ""}
              class="bk-context-image"
              src={fileProxyUrl((el as any).image_url ?? (el as any).slack_file?.url)}
            />
          </Show>
        )}
      </For>
    </div>
  );
}
