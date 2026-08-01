import { type ImageBlock, resolveMediaUrl } from "@slock/slack-api";
import { ZoomableImage } from "@slock/ui";
import { Show } from "solid-js";
import EmojiText from "../emoji/EmojiText";

export default function Image(props: { block: ImageBlock }) {
  return (
    <figure class="bk-image-block">
      <ZoomableImage
        alt={props.block.alt_text}
        class="bk-image-block-img"
        reservedHeight={240}
        reservedWidth={360}
        src={resolveMediaUrl(props.block.image_url)}
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
