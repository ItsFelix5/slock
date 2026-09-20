import { type ImageBlock, resolveMediaUrl } from "@slock/types";
import { constrainMediaDimensions, MediaFrame, ZoomableImage } from "@slock/ui";
import { Show } from "solid-js";
import EmojiText from "../emoji/EmojiText";

const URL_SUFFIX_PATTERN = /[?#]/;
const MAX_IMAGE_SIZE = 360;

function isGif(block: ImageBlock) {
  const url = block.image_url ?? block.slack_file?.url;
  return !!block.is_animated || !!url?.split(URL_SUFFIX_PATTERN)[0].toLowerCase().endsWith(".gif");
}

export default function Image(props: { block: ImageBlock }) {
  const src = () => resolveMediaUrl(props.block.image_url ?? props.block.slack_file?.url ?? "");
  const dimensions = () =>
    constrainMediaDimensions(
      props.block.image_width,
      props.block.image_height,
      MAX_IMAGE_SIZE,
      MAX_IMAGE_SIZE,
      MAX_IMAGE_SIZE,
      MAX_IMAGE_SIZE,
    );
  const image = () => (
    <ZoomableImage
      alt={props.block.alt_text}
      class="bk-image-block-img"
      reservedHeight={dimensions().height}
      reservedWidth={dimensions().width}
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
