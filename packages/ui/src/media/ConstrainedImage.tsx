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
      reservedHeight={props.height}
      reservedWidth={props.width}
      src={props.src}
    />
  );
}
