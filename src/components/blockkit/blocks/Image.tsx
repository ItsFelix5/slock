import { Show } from "solid-js";
import EmojiText from "../../messages/EmojiText";
import type { ImageBlock } from "../types";

export default function Image(props: { block: ImageBlock }) {
  return (
    <figure class="bk-image-block">
      <img class="bk-image-block-img" src={props.block.image_url} alt={props.block.alt_text} />
      <Show when={props.block.title}>
        <figcaption class="bk-image-block-title">
          <EmojiText text={props.block.title!.text} />
        </figcaption>
      </Show>
    </figure>
  );
}
