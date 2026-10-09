import { createEffect, createSignal, on, Show } from "solid-js";
import Icon from "./Icon";
import { ImageLightbox } from "./ImageLightbox";
import { constrainMediaDimensions } from "./mediaDimensions";
import "./ZoomableImage.css";

export interface ZoomableImageItem {
  alt?: string;
  src: string;
}

export interface ZoomableImageProps {
  alt?: string;
  class?: string;
  fullSrc?: string;
  gallery?: ZoomableImageItem[];
  galleryIndex?: number;
  reservedHeight: number;
  reservedWidth: number;
  src: string;

  blurSrc?: string;
  fitToImage?: boolean;
}

export default function ZoomableImage(props: ZoomableImageProps) {
  const [open, setOpen] = createSignal(false);
  const [galleryIndex, setGalleryIndex] = createSignal(0);
  const [previewFailed, setPreviewFailed] = createSignal(false);
  const [fitted, setFitted] = createSignal<{ width: number; height: number }>();
  const box = () => fitted() ?? { height: props.reservedHeight, width: props.reservedWidth };

  const fitToLoadedImage = (img: HTMLImageElement) => {
    if (!(props.fitToImage && img.naturalWidth && img.naturalHeight)) return;
    setFitted(
      constrainMediaDimensions(
        img.naturalWidth,
        img.naturalHeight,
        props.reservedWidth,
        props.reservedHeight,
        props.reservedWidth,
        props.reservedHeight,
      ),
    );
  };

  const gallery = (): ZoomableImageItem[] =>
    props.gallery?.length ? props.gallery : [{ alt: props.alt, src: props.fullSrc ?? props.src }];
  const initialGalleryIndex = () =>
    Math.max(0, Math.min(props.galleryIndex ?? 0, gallery().length - 1));
  const openPreview = () => {
    setGalleryIndex(initialGalleryIndex());
    setOpen(true);
  };

  createEffect(
    on(
      () => props.src,
      () => {
        setPreviewFailed(false);
        setFitted(undefined);
      },
      { defer: true },
    ),
  );

  return (
    <>
      <button
        aria-label={props.alt ? `Open image preview: ${props.alt}` : "Open image preview"}
        class="zoomable-image-trigger"
        onClick={openPreview}
        style={{
          "aspect-ratio": `${box().width} / ${box().height}`,
          width: `min(${box().width}px, 100%)`,
          "background-position": "center",
          "background-size": "cover",
          "background-image": props.blurSrc ? `url(${props.blurSrc})` : undefined,
        }}
        type="button"
      >
        <Show
          fallback={
            <span class="zoomable-image-unavailable flex-col gap-sm zoomable-image-unavailable-framed fill">
              <Icon name="image-broken" size={22} />
              <span>Preview unavailable</span>
            </span>
          }
          when={!previewFailed()}
        >
          <img
            alt={props.alt}
            class={`zoomable-image zoomable-image-framed fill ${props.class ?? ""}`}
            decoding="async"
            loading="lazy"
            onError={() => setPreviewFailed(true)}
            onLoad={(e) => fitToLoadedImage(e.currentTarget)}
            src={props.src}
          />
        </Show>
      </button>
      <Show when={open()}>
        <ImageLightbox
          gallery={gallery()}
          index={galleryIndex()}
          onClose={() => setOpen(false)}
          onIndexChange={setGalleryIndex}
        />
      </Show>
    </>
  );
}
