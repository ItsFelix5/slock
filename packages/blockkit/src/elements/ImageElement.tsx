import type { ImageElement as ImageElementType } from "@slock/slack-api";
import { ZoomableImage } from "@slock/ui";

export default function ImageElement(props: { el: ImageElementType }) {
  const src = props.el.image_url ?? props.el.slack_file?.url;
  if (!src) return null;
  return <ZoomableImage class="bk-image-el" src={src} alt={props.el.alt_text} />;
}
