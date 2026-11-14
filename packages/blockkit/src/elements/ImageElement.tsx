import type { ImageElement as ImageElementType } from "@slock/types";
import { ZoomableImage } from "@slock/ui";
import { safeMediaUrl } from "../safeUrl";
import "./ImageElement.css";

export default function ImageElement(props: { el: ImageElementType; icon?: boolean }) {
  const src = safeMediaUrl(props.el.image_url ?? props.el.slack_file?.url);
  if (!src) return null;
  if (props.icon)
    return (
      <img alt={props.el.alt_text} class="bk-image-el" decoding="async" loading="lazy" src={src} />
    );
  return (
    <ZoomableImage
      alt={props.el.alt_text}
      class="bk-image-el"
      reservedHeight={120}
      reservedWidth={240}
      src={src}
    />
  );
}
