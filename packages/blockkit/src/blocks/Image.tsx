import { fileProxyUrl, type ImageBlock } from "@slock/slack-api";
import { ZoomableImage } from "@slock/ui";
import { Show } from "solid-js";
import EmojiText from "../emoji/EmojiText";

export default function Image(props: { block: ImageBlock }) {
  return (
    <figure class="bk-image-block">
      <ZoomableImage
        alt={props.block.alt_text}
        class="bk-image-block-img"
        src={fileProxyUrl(props.block.image_url)}
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
