import { createSignal, onCleanup } from "solid-js";
import "./ResizeHandle.css";
import { startFrameCoalescedPointerDrag } from "../pointerDrag";
import { useCancelShortcut } from "../useEscapeClose";
import { useAdjustShortcuts } from "../useNavShortcuts";

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
  let rootRef: HTMLHRElement | undefined;
  let startWidth = 0;
  let stopDragging: (() => void) | undefined;
  const [dragging, setDragging] = createSignal(false);

  const endDrag = () => {
    stopDragging?.();
    stopDragging = undefined;
    setDragging(false);
  };

  useCancelShortcut(
    () => {
      props.setWidth(startWidth);
      endDrag();
    },
    { enabled: dragging },
  );

  useAdjustShortcuts({
    edge: (end) => props.setWidth(end === "start" ? props.min : props.max),
    root: () => rootRef,
    step: (direction, large) =>
      props.setWidth(
        resizeWidth(
          props.width(),
          direction * (large ? 40 : 10),
          props.direction,
          props.min,
          props.max,
        ),
      ),
  });

  const onPointerDown = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    endDrag();
    const startX = e.clientX;
    startWidth = props.width();
    setDragging(true);
    stopDragging = startFrameCoalescedPointerDrag((event) => {
      props.setWidth(
        resizeWidth(startWidth, event.clientX - startX, props.direction, props.min, props.max),
      );
    });
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
      onPointerDown={onPointerDown}
      ref={rootRef}
      tabIndex={0}
    />
  );
}
