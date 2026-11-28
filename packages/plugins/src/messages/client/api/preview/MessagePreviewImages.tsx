import {
  constrainMediaDimensions,
  HideBrokenImage,
  ImageUnavailable,
  mediaBoxStyle,
} from "@slock/ui";
import { createMemo, For, Show } from "solid-js";
import { type PreviewContent, previewImages } from "./previewContent";
import "./MessagePreviewImages.css";

const MAX_IMAGES = 4;
const TILE = { height: 72, width: 72 };

export default function MessagePreviewImages(props: PreviewContent) {
  const images = createMemo(() => previewImages(props));
  const size = (width: number | undefined, height: number | undefined) =>
    images().length === 1 ? constrainMediaDimensions(width, height, 260, 140, 210, 140) : TILE;
  return (
    <Show when={images().length}>
      <div class="message-preview-images">
        <For each={images().slice(0, MAX_IMAGES)}>
          {(image) => {
            const box = () => size(image.width, image.height);
            return (
              <span class="message-preview-image" style={mediaBoxStyle(box().width, box().height)}>
                <HideBrokenImage
                  alt={image.alt}
                  class="fill"
                  decoding="async"
                  fallback={<ImageUnavailable compact={images().length > 1} />}
                  loading="lazy"
                  src={image.src}
                />
              </span>
            );
          }}
        </For>
        <Show when={images().length > MAX_IMAGES}>
          <span class="meta-dim">+{images().length - MAX_IMAGES}</span>
        </Show>
      </div>
    </Show>
  );
}
