import "./ResizeHandle.css";
import { onCleanup } from "solid-js";
import { resizeWidth } from "./resizeMath";

export default function ResizeHandle(props: {
  width: () => number;
  setWidth: (w: number) => void;
  min: number;
  max: number;
  /** 1 if dragging right should grow the panel (handle on its right edge), -1 if it should shrink it (handle on its left edge). */
  direction: 1 | -1;
  side: "left" | "right";
  label?: string;
}) {
  let startX = 0;
  let startWidth = 0;

  const stopDragging = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDragging);
    window.removeEventListener("pointercancel", stopDragging);
    window.removeEventListener("blur", stopDragging);
    window.removeEventListener("keydown", onDragKeyDown);
  };

  const onPointerMove = (event: PointerEvent) => {
    props.setWidth(
      resizeWidth(startWidth, event.clientX - startX, props.direction, props.min, props.max),
    );
  };

  const onDragKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    props.setWidth(startWidth);
    stopDragging();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    stopDragging();
    startX = e.clientX;
    startWidth = props.width();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    window.addEventListener("blur", stopDragging);
    window.addEventListener("keydown", onDragKeyDown);
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

  onCleanup(stopDragging);

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
