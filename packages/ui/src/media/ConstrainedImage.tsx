import ZoomableImage from "./ZoomableImage";

export interface ConstrainedImageProps {
  alt?: string;
  blurSrc?: string;
  class?: string;
  fullSrc?: string;
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
      fullSrc={props.fullSrc}
      height={props.height}
      reservedHeight={props.height}
      reservedWidth={props.width}
      src={props.src}
      width={props.width}
    />
  );
}
