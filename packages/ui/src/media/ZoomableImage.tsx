import { createEffect, createSignal, type JSX, on, Show } from "solid-js";
import Overlay from "../overlay/Overlay";
import { useEscapeClose } from "../useEscapeClose";
import Icon from "./Icon";
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
  height?: number;
  reservedHeight?: number;
  reservedWidth?: number;
  src: string;
  width?: number;

  blurSrc?: string;
}

export default function ZoomableImage(props: ZoomableImageProps) {
  const [open, setOpen] = createSignal(false);
  const [galleryIndex, setGalleryIndex] = createSignal(0);
  const [previewFailed, setPreviewFailed] = createSignal(false);

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
      () => setPreviewFailed(false),
      { defer: true },
    ),
  );

  const triggerStyle = (): JSX.CSSProperties | undefined => {
    const style: JSX.CSSProperties = {};
    if (props.blurSrc && !previewFailed()) {
      style["background-image"] = `url(${props.blurSrc})`;
      style["background-position"] = "center";
      style["background-size"] = "cover";
    }
    if (props.reservedWidth && props.reservedHeight) {
      style.width = `min(${props.reservedWidth}px, 100%)`;
      style["aspect-ratio"] = `${props.reservedWidth} / ${props.reservedHeight}`;
      style.overflow = "hidden";
    }
    return Object.keys(style).length ? style : undefined;
  };

  return (
    <>
      <button
        aria-label={props.alt ? `Open image preview: ${props.alt}` : "Open image preview"}
        class="zoomable-image-trigger"
        onClick={openPreview}
        style={triggerStyle()}
        type="button"
      >
        <Show
          fallback={
            <span
              class={`zoomable-image-unavailable${props.reservedWidth && props.reservedHeight ? " zoomable-image-unavailable-framed" : ""}`}
            >
              <Icon name="image-broken" size={22} />
              <span>Preview unavailable</span>
            </span>
          }
          when={!previewFailed()}
        >
          <img
            alt={props.alt}
            class={`zoomable-image ${props.class ?? ""}${props.reservedWidth && props.reservedHeight ? " zoomable-image-framed" : ""}`}
            height={props.height}
            loading="lazy"
            onError={() => setPreviewFailed(true)}
            src={props.src}
            width={props.width}
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

const LENS_SIZE = 500;
const LENS_ZOOM_DEFAULT = 5;
const LENS_ZOOM_STEP = 0.5;
const LENS_PAN_STEP = 24;

const MIN_DISPLAY_SIZE = 320;
const MAX_UPSCALE = 8;

function ImageLightbox(props: {
  gallery: ZoomableImageItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  useEscapeClose(props.onClose);

  // biome-ignore lint/suspicious/noUnassignedVariables: standard Solid ref pattern
  let imgRef: HTMLImageElement | undefined;
  const [lens, setLens] = createSignal<{ x: number; y: number } | null>(null);
  const [lensZoom, setLensZoom] = createSignal(LENS_ZOOM_DEFAULT);
  const [loading, setLoading] = createSignal(true);
  const [failed, setFailed] = createSignal(false);
  const [naturalSize, setNaturalSize] = createSignal<{ w: number; h: number } | null>(null);
  const image = () => props.gallery[props.index];
  const hasPrevious = () => props.index > 0;
  const hasNext = () => props.index < props.gallery.length - 1;

  createEffect(
    on(
      () => image().src,
      () => {
        setFailed(false);
        setLoading(true);
        setLensZoom(LENS_ZOOM_DEFAULT);
        setNaturalSize(null);
      },
      { defer: true },
    ),
  );

  const upscaleStyle = (): JSX.CSSProperties | undefined => {
    const size = naturalSize();
    if (!size) return;
    const longest = Math.max(size.w, size.h);
    if (!longest || longest >= MIN_DISPLAY_SIZE) return;
    const scale = Math.min(MAX_UPSCALE, MIN_DISPLAY_SIZE / longest);
    return { width: `${size.w * scale}px`, height: `${size.h * scale}px` };
  };

  const moveLens = (e: MouseEvent) => {
    const rect = imgRef?.getBoundingClientRect();
    if (!rect) return;
    setLens({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const zoomLens = (e: WheelEvent) => {
    if (!lens()) return;
    e.preventDefault();
    setLensZoom((z) =>
      Math.max(LENS_ZOOM_STEP, z + (e.deltaY < 0 ? LENS_ZOOM_STEP : -LENS_ZOOM_STEP)),
    );
  };

  const focusLens = () => {
    const rect = imgRef?.getBoundingClientRect();
    if (!rect) return;
    setLens((current) => current ?? { x: rect.width / 2, y: rect.height / 2 });
  };

  const nudgeLens = (dx: number, dy: number) => {
    const rect = imgRef?.getBoundingClientRect();
    if (!rect) return;
    setLens((current) => {
      const base = current ?? { x: rect.width / 2, y: rect.height / 2 };
      return {
        x: Math.max(0, Math.min(rect.width, base.x + dx)),
        y: Math.max(0, Math.min(rect.height, base.y + dy)),
      };
    });
  };

  const handleLensKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") nudgeLens(0, -LENS_PAN_STEP);
    else if (e.key === "ArrowDown") nudgeLens(0, LENS_PAN_STEP);
    else if (e.key === "ArrowLeft") nudgeLens(-LENS_PAN_STEP, 0);
    else if (e.key === "ArrowRight") nudgeLens(LENS_PAN_STEP, 0);
    else if (e.key === "+" || e.key === "=") setLensZoom((z) => z + LENS_ZOOM_STEP);
    else if (e.key === "-") setLensZoom((z) => Math.max(LENS_ZOOM_STEP, z - LENS_ZOOM_STEP));
    else return;
    e.preventDefault();
  };

  return (
    <Overlay
      ariaLabel={image().alt ? `Image preview: ${image().alt}` : "Image preview"}
      onClose={props.onClose}
    >
      <button
        aria-label="Close image preview"
        class="zoomable-image-close"
        onClick={props.onClose}
        type="button"
      >
        <Icon name="close" size={20} />
      </button>
      <Show when={props.gallery.length > 1}>
        <button
          aria-label="Previous image"
          class="zoomable-image-navigation zoomable-image-previous"
          disabled={!hasPrevious()}
          onClick={() => props.onIndexChange(props.index - 1)}
          type="button"
        >
          <Icon name="arrow-left" size={20} />
        </button>
        <button
          aria-label="Next image"
          class="zoomable-image-navigation zoomable-image-next"
          disabled={!hasNext()}
          onClick={() => props.onIndexChange(props.index + 1)}
          type="button"
        >
          <Icon name="arrow-right" size={20} />
        </button>
      </Show>
      <Show
        fallback={
          <div class="zoomable-image-error">
            <Icon name="image-broken" size={28} />
            <div>Couldn't load this image.</div>
            <div class="zoomable-image-error-actions">
              <button
                class="zoomable-image-action"
                onClick={() => {
                  setFailed(false);
                  setLoading(true);
                }}
                type="button"
              >
                Try again
              </button>
              <a
                class="zoomable-image-action"
                href={image().src}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open image
              </a>
            </div>
          </div>
        }
        when={!failed()}
      >
        <div
          aria-label="Magnify image. Arrow keys pan, plus and minus zoom."
          class="zoomable-image-spyglass-area"
          onBlur={() => setLens(null)}
          onFocus={focusLens}
          onKeyDown={handleLensKeyDown}
          onMouseDown={moveLens}
          onMouseLeave={() => setLens(null)}
          onMouseMove={(e) => lens() && moveLens(e)}
          onMouseUp={() => setLens(null)}
          onWheel={zoomLens}
          tabIndex={0}
        >
          <img
            alt={image().alt}
            class="zoomable-image-full"
            classList={{ "zoomable-image-full-loading": loading() }}
            draggable={false}
            onError={() => {
              setFailed(true);
              setLoading(false);
            }}
            onLoad={(e) => {
              setLoading(false);
              const img = e.currentTarget;
              setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
            }}
            ref={imgRef}
            src={image().src}
            style={upscaleStyle()}
          />
          <Show when={lens()}>
            {(pos) => {
              const rect = () => imgRef?.getBoundingClientRect();
              return (
                <div
                  class="zoomable-image-lens"
                  style={{
                    "background-image": `url(${image().src})`,
                    "background-position": `${LENS_SIZE / 2 - pos().x * lensZoom()}px ${LENS_SIZE / 2 - pos().y * lensZoom()}px`,
                    "background-size": `${(rect()?.width ?? 0) * lensZoom()}px ${(rect()?.height ?? 0) * lensZoom()}px`,
                    height: `${LENS_SIZE}px`,
                    left: `${pos().x - LENS_SIZE / 2}px`,
                    top: `${pos().y - LENS_SIZE / 2}px`,
                    width: `${LENS_SIZE}px`,
                  }}
                />
              );
            }}
          </Show>
        </div>
        <Show when={loading()}>
          <div aria-live="polite" class="zoomable-image-loading">
            Loading image…
          </div>
        </Show>
      </Show>
    </Overlay>
  );
}
