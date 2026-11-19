import { createEffect, createSignal, on, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import Icon from "../Icon";
import { imageSrc } from "../mediaSrc";
import { ImageLightbox } from "./ImageLightbox";
import { mediaBoxStyle } from "./mediaDimensions";
import "./ZoomableImage.css";

export interface ZoomableImageItem {
  alt?: string;
  onInfo?: () => void;
  src: string;
}

export interface ZoomableImageProps {
  alt?: string;
  class?: string;
  fullSrc?: string;
  gallery?: ZoomableImageItem[];
  galleryIndex?: number;
  overlay?: JSX.Element;
  reservedHeight: number;
  reservedWidth: number;
  src: string;

  blurSrc?: string;
}

export default function ZoomableImage(props: ZoomableImageProps) {
  const [open, setOpen] = createSignal(false);
  const [galleryIndex, setGalleryIndex] = createSignal(0);
  const [previewFailed, setPreviewFailed] = createSignal(false);

  const gallery = (): ZoomableImageItem[] =>
    props.gallery?.length ? props.gallery : [{ alt: props.alt, src: props.fullSrc ?? props.src }];
  const initialGalleryIndex = () =>
    clamp(props.galleryIndex ?? 0, 0, gallery().length - 1);
  const openPreview = () => {
    setGalleryIndex(initialGalleryIndex());
    setOpen(true);
  };

  createEffect(
    on(
      () => props.src,
      () => {
        setPreviewFailed(false);
      },
      { defer: true },
    ),
  );

  return (
    <>
      <div
        class="zoomable-image-frame"
        style={mediaBoxStyle(props.reservedWidth, props.reservedHeight)}
      >
        <button
          aria-label={props.alt ? `Open image preview: ${props.alt}` : "Open image preview"}
          class="zoomable-image-trigger"
          onClick={openPreview}
          style={{
            "background-position": "center",
            "background-size": "cover",
            "background-image": props.blurSrc ? `url(${imageSrc(props.blurSrc)})` : undefined,
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
              src={imageSrc(props.src)}
            />
          </Show>
        </button>
        <Show when={props.overlay}>
          <div class="zoomable-image-overlay">{props.overlay}</div>
        </Show>
      </div>
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
