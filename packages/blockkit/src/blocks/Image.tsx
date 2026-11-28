import type { ImageBlock } from "@slock/types";
import {
  constrainMediaDimensions,
  formatSize,
  isGifUrl,
  MediaFrame,
  ZoomableImage,
} from "@slock/ui";
import { Show } from "solid-js";
import EmojiText from "../emoji/EmojiText";
import "./Image.css";
import { safeMediaUrl } from "../safeUrl";

const MAX_IMAGE_SIZE = 360;

function isGif(block: ImageBlock) {
  return !!block.is_animated || isGifUrl(block.image_url ?? block.slack_file?.url);
}

export default function Image(props: { block: ImageBlock }) {
  const src = () => safeMediaUrl(props.block.image_url ?? props.block.slack_file?.url);
  const dimensions = () =>
    constrainMediaDimensions(
      props.block.image_width,
      props.block.image_height,
      MAX_IMAGE_SIZE,
      MAX_IMAGE_SIZE,
      MAX_IMAGE_SIZE,
      MAX_IMAGE_SIZE,
    );
  const frameTitle = () => {
    const size = formatSize(props.block.image_bytes);
    const title = props.block.title?.text;
    const name = title && title !== "GIF" ? title : props.block.alt_text || title || "GIF";
    return [name, size && `(${size})`].filter(Boolean).join(" ");
  };
  const image = () => (
    <ZoomableImage
      alt={props.block.alt_text}
      class="bk-image-block-img"
      reservedHeight={dimensions().height}
      reservedWidth={dimensions().width}
      src={src() ?? ""}
    />
  );
  return (
    <Show when={src()}>
      <Show
        fallback={
          <figure class="bk-image-block flex-col">
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
        <MediaFrame title={frameTitle()}>{image()}</MediaFrame>
      </Show>
    </Show>
  );
}
