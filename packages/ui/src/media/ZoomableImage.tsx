import { createEffect, createSignal, type JSX, on, Show } from "solid-js";
import Overlay from "../overlay/Overlay";
import { useEscapeClose } from "../useEscapeClose";
import Icon from "./Icon";
import "./ZoomableImage.css";

export interface ZoomableImageProps {
  alt?: string;
  class?: string;
  fullSrc?: string;
  height?: number;
  reservedHeight?: number;
  reservedWidth?: number;
  src: string;
  width?: number;
  // A tiny (often base64) low-res image shown behind the real one — since
  // the real <img> box is already reserved via width/height (see mapFile in
  // slack-api), this just fills that box with a blurred preview instead of
  // blank space while `src` (lazy-)loads.
  blurSrc?: string;
}

export default function ZoomableImage(props: ZoomableImageProps) {
  const [open, setOpen] = createSignal(false);
  const [previewFailed, setPreviewFailed] = createSignal(false);

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
        onClick={() => setOpen(true)}
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
          alt={props.alt}
          onClose={() => setOpen(false)}
          src={props.fullSrc ?? props.src}
        />
      </Show>
    </>
  );
}

const LENS_SIZE = 500;
const LENS_ZOOM_DEFAULT = 5;
const LENS_ZOOM_STEP = 0.5;
const LENS_PAN_STEP = 24;
// small images (icons, tiny screenshots) get lost at native size in the lightbox,
// so upscale anything whose longest edge is under this back up to it
const MIN_DISPLAY_SIZE = 320;
const MAX_UPSCALE = 8;

function ImageLightbox(props: { src: string; alt?: string; onClose: () => void }) {
  useEscapeClose(props.onClose);
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let imgRef: HTMLImageElement | undefined;
  const [lens, setLens] = createSignal<{ x: number; y: number } | null>(null);
  const [lensZoom, setLensZoom] = createSignal(LENS_ZOOM_DEFAULT);
  const [loading, setLoading] = createSignal(true);
  const [failed, setFailed] = createSignal(false);
  const [naturalSize, setNaturalSize] = createSignal<{ w: number; h: number } | null>(null);

  createEffect(
    on(
      () => props.src,
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
    if (!size) return undefined;
    const longest = Math.max(size.w, size.h);
    if (!longest || longest >= MIN_DISPLAY_SIZE) return undefined;
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

  // Keyboard equivalent of the mouse-driven lens above: focusing the area
  // centers it, arrow keys pan it (clamped to the image bounds), +/- zoom.
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
      ariaLabel={props.alt ? `Image preview: ${props.alt}` : "Image preview"}
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
      <Show
        fallback={
          <div class="zoomable-image-error" role="alert">
            <Icon name="image-broken" size={28} />
            <div>Couldn’t load this image.</div>
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
                href={props.src}
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
          role="application"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a 2D pan/zoom lens has no standard interactive ARIA role; it's a real keyboard control (arrow keys pan, +/- zoom) once focused
          tabIndex={0}
        >
          <img
            alt={props.alt}
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
            src={props.src}
            style={upscaleStyle()}
          />
          <Show when={lens()}>
            {(pos) => {
              const rect = () => imgRef?.getBoundingClientRect();
              return (
                <div
                  class="zoomable-image-lens"
                  style={{
                    "background-image": `url(${props.src})`,
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
          <div aria-live="polite" class="zoomable-image-loading" role="status">
            Loading image…
          </div>
        </Show>
      </Show>
    </Overlay>
  );
}
