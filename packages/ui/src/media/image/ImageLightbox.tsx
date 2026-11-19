import { clamp } from "@slock/core";
import { createEffect, createSignal, on, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import IconButton from "../../button/IconButton";
import { useEscapeClose } from "../../hooks/useEscapeClose";
import { useNavigationShortcuts } from "../../hooks/useNavShortcuts";
import { inside, useShortcut } from "../../hooks/useShortcut";
import Overlay from "../../overlay/Overlay";
import Icon from "../Icon";
import { imageSrc } from "../mediaSrc";
import "./ImageLightbox.css";
import { defined } from "@slock/core";
import type { ZoomableImageItem } from "./ZoomableImage";

const LENS_SIZE = 500;
const LENS_ZOOM_DEFAULT = 5;
const LENS_ZOOM_STEP = 0.5;
const LENS_PAN_STEP = 24;
const LENS_PAN = {
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
} as const;
const MIN_DISPLAY_SIZE = 320;
const MAX_UPSCALE = 8;

export function ImageLightbox(props: {
  gallery: ZoomableImageItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  let lensAreaRef: HTMLDivElement | undefined;
  useEscapeClose(props.onClose);

  let imgRef: HTMLImageElement | undefined;
  const [lens, setLens] = createSignal<{ x: number; y: number } | null>(null);
  const [lensZoom, setLensZoom] = createSignal(LENS_ZOOM_DEFAULT);
  const [loading, setLoading] = createSignal(true);
  const [failed, setFailed] = createSignal(false);
  const [naturalSize, setNaturalSize] = createSignal<{ w: number; h: number } | null>(null);
  const index = () => clamp(props.index, 0, props.gallery.length - 1);
  const image = () => defined(props.gallery[index()]);
  const hasPrevious = () => index() > 0;
  const hasNext = () => index() < props.gallery.length - 1;

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
        x: clamp(base.x + dx, 0, rect.width),
        y: clamp(base.y + dy, 0, rect.height),
      };
    });
  };

  const lensTarget = inside(() => lensAreaRef);
  useNavigationShortcuts({
    directions: ["up", "down", "left", "right"],
    move: (direction) => {
      const [dx, dy] = LENS_PAN[direction];
      nudgeLens(dx * LENS_PAN_STEP, dy * LENS_PAN_STEP);
    },
    root: () => lensAreaRef,
  });
  const zoomLensBy = (delta: number) => setLensZoom((z) => Math.max(LENS_ZOOM_STEP, z + delta));
  const lensZoomShortcut = {
    allowRepeat: true,
    scope: "general",
    group: "Media",
    splitModifier: true,
    target: lensTarget,
  } as const;
  useShortcut({
    ...lensZoomShortcut,
    combo: { key: ["=", "+"] },
    handler: () => zoomLensBy(LENS_ZOOM_STEP),
    id: "lens.zoomIn",
    label: "Zoom the magnifier in",
  });
  useShortcut({
    ...lensZoomShortcut,
    combo: { key: "-" },
    handler: () => zoomLensBy(-LENS_ZOOM_STEP),
    id: "lens.zoomOut",
    label: "Zoom the magnifier out",
  });

  return (
    <Overlay
      ariaLabel={image().alt ? `Image preview: ${image().alt}` : "Image preview"}
      onClose={props.onClose}
    >
      <div class="zoomable-image-toolbar">
        <Show when={image().onInfo}>
          {(onInfo) => (
            <IconButton
              class="panel-close-btn"
              icon="info"
              iconSize={18}
              label="File info"
              onClick={() => {
                props.onClose();
                onInfo()();
              }}
            />
          )}
        </Show>
        <IconButton class="panel-close-btn" icon="close" iconSize={18} onClick={props.onClose} />
      </div>
      <Show when={props.gallery.length > 1}>
        <button
          aria-label="Previous image"
          class="zoomable-image-navigation zoomable-image-previous"
          disabled={!hasPrevious()}
          onClick={() => hasPrevious() && props.onIndexChange(index() - 1)}
          type="button"
        >
          <Icon name="arrow-left" size={20} />
        </button>
        <button
          aria-label="Next image"
          class="zoomable-image-navigation zoomable-image-next"
          disabled={!hasNext()}
          onClick={() => hasNext() && props.onIndexChange(index() + 1)}
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
                href={imageSrc(image().src)}
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
          ref={lensAreaRef}
          onBlur={() => setLens(null)}
          onFocus={focusLens}
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
            src={imageSrc(image().src)}
            style={upscaleStyle()}
          />
          <Show when={lens()}>
            {(pos) => {
              const rect = () => imgRef?.getBoundingClientRect();
              return (
                <div
                  class="zoomable-image-lens"
                  style={{
                    "background-image": `url(${imageSrc(image().src)})`,
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
