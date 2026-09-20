import { type ContextBlock, resolveMediaUrl } from "@slock/types";
import { For } from "solid-js";
import BkText from "../BkText";

export default function Context(props: { block: ContextBlock }) {
  return (
    <div class="bk-context">
      <For each={props.block.elements}>
        {(el) =>
          el.type === "image" ? (
            <img
              alt={el.alt_text ?? ""}
              class="bk-context-image"
              src={resolveMediaUrl(el.image_url ?? el.slack_file?.url ?? "")}
            />
          ) : (
            <BkText class="bk-context-text" text={el} />
          )
        }
      </For>
    </div>
  );
}
