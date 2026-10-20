import type { JSX } from "solid-js";
import ZoomableImage, { type ZoomableImageItem } from "./ZoomableImage";

export interface ConstrainedImageProps {
  alt?: string;
  blurSrc?: string;
  class?: string;
  crop?: boolean;
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
      fitToImage={!props.crop}
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
