import { createSignal, Show } from "solid-js";
import Overlay from "./Overlay";
import { useEscapeClose } from "./useEscapeClose";
import "./ZoomableImage.css";

export interface ZoomableImageProps {
  src: string;
  fullSrc?: string;
  alt?: string;
  class?: string;
  width?: number;
  height?: number;
}

export default function ZoomableImage(props: ZoomableImageProps) {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      <button type="button" class="zoomable-image-trigger" onClick={() => setOpen(true)}>
        <img
          class={`zoomable-image ${props.class ?? ""}`}
          src={props.src}
          alt={props.alt}
          width={props.width}
          height={props.height}
        />
      </button>
      <Show when={open()}>
        <ImageLightbox
          src={props.fullSrc ?? props.src}
          alt={props.alt}
          onClose={() => setOpen(false)}
        />
      </Show>
    </>
  );
}

const LENS_SIZE = 500;
const LENS_ZOOM = 5;

function ImageLightbox(props: { src: string; alt?: string; onClose: () => void }) {
  useEscapeClose(props.onClose);
  let imgRef: HTMLImageElement | undefined;
  const [lens, setLens] = createSignal<{ x: number; y: number } | null>(null);

  const moveLens = (e: MouseEvent) => {
    const rect = imgRef?.getBoundingClientRect();
    if (!rect) return;
    setLens({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <Overlay onClose={props.onClose}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: mouse-driven magnifier lens has no keyboard equivalent */}
      <div
        class="zoomable-image-spyglass-area"
        onMouseDown={moveLens}
        onMouseMove={(e) => lens() && moveLens(e)}
        onMouseUp={() => setLens(null)}
        onMouseLeave={() => setLens(null)}
      >
        <img
          ref={imgRef}
          class="zoomable-image-full"
          src={props.src}
          alt={props.alt}
          draggable={false}
        />
        <Show when={lens()}>
          {(pos) => {
            const rect = () => imgRef?.getBoundingClientRect();
            return (
              <div
                class="zoomable-image-lens"
                style={{
                  left: `${pos().x - LENS_SIZE / 2}px`,
                  top: `${pos().y - LENS_SIZE / 2}px`,
                  width: `${LENS_SIZE}px`,
                  height: `${LENS_SIZE}px`,
                  "background-image": `url(${props.src})`,
                  "background-size": `${(rect()?.width ?? 0) * LENS_ZOOM}px ${(rect()?.height ?? 0) * LENS_ZOOM}px`,
                  "background-position": `-${pos().x * LENS_ZOOM - LENS_SIZE / 2}px -${pos().y * LENS_ZOOM - LENS_SIZE / 2}px`,
                }}
              />
            );
          }}
        </Show>
      </div>
    </Overlay>
  );
}
