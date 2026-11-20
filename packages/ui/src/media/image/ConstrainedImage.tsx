import type { JSX } from "@solidjs/web";
import ZoomableImage, { type ZoomableImageItem } from "./ZoomableImage";

export interface ConstrainedImageProps {
  alt?: string;
  blurSrc?: string;
  class?: string;
  fullSrc?: string;
  gallery?: ZoomableImageItem[];
  galleryIndex?: number;
  height: number;
  overlay?: JSX.Element;
  src: string;
  width: number;
}

export default function ConstrainedImage(props: ConstrainedImageProps) {
  return (
    <ZoomableImage
      alt={props.alt}
      blurSrc={props.blurSrc}
      class={props.class}
      fullSrc={props.fullSrc}
      gallery={props.gallery}
      galleryIndex={props.galleryIndex}
      overlay={props.overlay}
      reservedHeight={props.height}
      reservedWidth={props.width}
      src={props.src}
    />
  );
}
