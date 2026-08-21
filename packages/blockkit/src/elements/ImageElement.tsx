import { type ImageElement as ImageElementType, resolveMediaUrl } from "@slock/types";
import { ZoomableImage } from "@slock/ui";

export default function ImageElement(props: { el: ImageElementType }) {
  const src = props.el.image_url ?? props.el.slack_file?.url;
  if (!src) return null;
  return (
    <ZoomableImage
      alt={props.el.alt_text}
      class="bk-image-el"
      reservedHeight={120}
      reservedWidth={240}
      src={resolveMediaUrl(src)}
    />
  );
}
