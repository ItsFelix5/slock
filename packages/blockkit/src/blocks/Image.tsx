import { type ImageBlock, resolveMediaUrl } from "@slock/types";
import { MediaFrame, ZoomableImage } from "@slock/ui";
import { Show } from "solid-js";
import EmojiText from "../emoji/EmojiText";

const URL_SUFFIX_PATTERN = /[?#]/;

function isGif(block: ImageBlock) {
  const url = block.image_url ?? block.slack_file?.url;
  return !!block.is_animated || !!url?.split(URL_SUFFIX_PATTERN)[0].toLowerCase().endsWith(".gif");
}

export default function Image(props: { block: ImageBlock }) {
  const src = () => resolveMediaUrl(props.block.image_url ?? props.block.slack_file?.url ?? "");
  const image = () => (
    <ZoomableImage
      alt={props.block.alt_text}
      class="bk-image-block-img"
      reservedHeight={props.block.image_height ?? 240}
      reservedWidth={props.block.image_width ?? 360}
      src={src()}
    />
  );
  return (
    <Show
      fallback={
        <figure class="bk-image-block">
          {image()}
          <Show when={props.block.title}>
            {(title) => (
              <figcaption class="bk-image-block-title">
                <EmojiText text={title().text} />
              </figcaption>
            )}
          </Show>
        </figure>
      }
      when={isGif(props.block)}
    >
      <MediaFrame title="GIF">{image()}</MediaFrame>
    </Show>
  );
}
