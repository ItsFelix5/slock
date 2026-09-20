import { createSignal, onCleanup } from "solid-js";
import "./ResizeHandle.css";
import { startFrameCoalescedPointerDrag } from "../pointerDrag";

function resizeWidth(
  width: number,
  pointerDelta: number,
  direction: 1 | -1,
  min: number,
  max: number,
) {
  return Math.min(max, Math.max(min, width + pointerDelta * direction));
}

let cachedWindowWidth: (() => number) | undefined;

export function windowWidth(): number {
  if (!cachedWindowWidth) {
    const [get, set] = createSignal(window.innerWidth);
    window.addEventListener("resize", () => set(window.innerWidth));
    cachedWindowWidth = get;
  }
  return cachedWindowWidth();
}

export default function ResizeHandle(props: {
  width: () => number;
  setWidth: (w: number) => void;
  min: number;
  max: number;
  direction: 1 | -1;
  side: "left" | "right";
  label?: string;
}) {
  let startWidth = 0;
  let stopDragging: (() => void) | undefined;

  const endDrag = () => {
    stopDragging?.();
    stopDragging = undefined;
    window.removeEventListener("keydown", onDragKeyDown);
  };

  const onDragKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    props.setWidth(startWidth);
    endDrag();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    endDrag();
    const startX = e.clientX;
    startWidth = props.width();
    window.addEventListener("keydown", onDragKeyDown);
    stopDragging = startFrameCoalescedPointerDrag((event) => {
      props.setWidth(
        resizeWidth(startWidth, event.clientX - startX, props.direction, props.min, props.max),
      );
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    let next: number | undefined;
    if (event.key === "Home") next = props.min;
    else if (event.key === "End") next = props.max;
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const pointerDelta = (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 40 : 10);
      next = resizeWidth(props.width(), pointerDelta, props.direction, props.min, props.max);
    }
    if (next === undefined) return;
    event.preventDefault();
    props.setWidth(next);
  };

  onCleanup(endDrag);

  return (
    <hr
      aria-label={props.label ?? "Resize panel"}
      aria-orientation="vertical"
      aria-valuemax={props.max}
      aria-valuemin={props.min}
      aria-valuenow={Math.round(props.width())}
      class="resize-handle"
      classList={{ [props.side]: true }}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      tabIndex={0}
    />
  );
}
