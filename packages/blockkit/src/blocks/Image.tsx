import type { ImageBlock } from "@slock/slack-api";
import { ZoomableImage } from "@slock/ui";
import { Show } from "solid-js";
import EmojiText from "../EmojiText";

export default function Image(props: { block: ImageBlock }) {
  return (
    <figure class="bk-image-block">
      <ZoomableImage
        class="bk-image-block-img"
        src={props.block.image_url}
        alt={props.block.alt_text}
      />
      <Show when={props.block.title}>
        {(title) => (
          <figcaption class="bk-image-block-title">
            <EmojiText text={title().text} />
          </figcaption>
        )}
      </Show>
    </figure>
  );
}
