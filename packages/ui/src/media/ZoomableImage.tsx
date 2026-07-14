import { createSignal, Show } from "solid-js";
import Overlay from "../overlay/Overlay";
import { useEscapeClose } from "../useEscapeClose";
import "./ZoomableImage.css";

export interface ZoomableImageProps {
  alt?: string;
  class?: string;
  fullSrc?: string;
  height?: number;
  src: string;
  width?: number;
}

export default function ZoomableImage(props: ZoomableImageProps) {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      <button class="zoomable-image-trigger" onClick={() => setOpen(true)} type="button">
        <img
          alt={props.alt}
          class={`zoomable-image ${props.class ?? ""}`}
          height={props.height}
          src={props.src}
          width={props.width}
        />
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
        onMouseLeave={() => setLens(null)}
        onMouseMove={(e) => lens() && moveLens(e)}
        onMouseUp={() => setLens(null)}
      >
        <img
          alt={props.alt}
          class="zoomable-image-full"
          draggable={false}
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
                  "background-position": `-${pos().x * LENS_ZOOM - LENS_SIZE / 2}px -${pos().y * LENS_ZOOM - LENS_SIZE / 2}px`,
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
    </Overlay>
  );
}
