import { createEffect, createSignal, on, Show } from "solid-js";
import Overlay from "../overlay/Overlay";
import { useEscapeClose } from "../useEscapeClose";
import Icon from "./Icon";
import "./ZoomableImage.css";

export interface ZoomableImageProps {
  alt?: string;
  class?: string;
  fullSrc?: string;
  height?: number;
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

  return (
    <>
      <button
        aria-label={props.alt ? `Open image preview: ${props.alt}` : "Open image preview"}
        class="zoomable-image-trigger"
        onClick={() => setOpen(true)}
        style={
          props.blurSrc && !previewFailed()
            ? {
                "background-image": `url(${props.blurSrc})`,
                "background-position": "center",
                "background-size": "cover",
              }
            : undefined
        }
        type="button"
      >
        <Show
          fallback={
            <span class="zoomable-image-unavailable">
              <Icon name="image-broken" size={22} />
              <span>Preview unavailable</span>
            </span>
          }
          when={!previewFailed()}
        >
          <img
            alt={props.alt}
            class={`zoomable-image ${props.class ?? ""}`}
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
const LENS_ZOOM = 5;

function ImageLightbox(props: { src: string; alt?: string; onClose: () => void }) {
  useEscapeClose(props.onClose);
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let imgRef: HTMLImageElement | undefined;
  const [lens, setLens] = createSignal<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [failed, setFailed] = createSignal(false);

  createEffect(
    on(
      () => props.src,
      () => {
        setFailed(false);
        setLoading(true);
      },
      { defer: true },
    ),
  );

  const moveLens = (e: MouseEvent) => {
    const rect = imgRef?.getBoundingClientRect();
    if (!rect) return;
    setLens({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
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
        {/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-driven magnifier lens has no keyboard equivalent */}
        <div
          class="zoomable-image-spyglass-area"
          onMouseDown={moveLens}
          onMouseLeave={() => setLens(null)}
          onMouseMove={(e) => lens() && moveLens(e)}
          onMouseUp={() => setLens(null)}
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
            onLoad={() => setLoading(false)}
            ref={imgRef}
            src={props.src}
          />
          <Show when={lens()}>
            {(pos) => {
              const rect = () => imgRef?.getBoundingClientRect();
              return (
                <div
                  class="zoomable-image-lens"
                  style={{
                    "background-image": `url(${props.src})`,
                    "background-position": `${LENS_SIZE / 2 - pos().x * LENS_ZOOM}px ${LENS_SIZE / 2 - pos().y * LENS_ZOOM}px`,
                    "background-size": `${(rect()?.width ?? 0) * LENS_ZOOM}px ${(rect()?.height ?? 0) * LENS_ZOOM}px`,
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
