import { onCleanup } from "solid-js";
import { startFrameCoalescedPointerDrag } from "../pointerDrag";
import { useAdjustShortcuts } from "../useNavShortcuts";
import "./PaneDivider.css";

export default function PaneDivider(props: {
  positionPercent: number;
  onDrag: (deltaFraction: number) => void;
}) {
  let handleEl: HTMLHRElement | undefined;
  let stopDragging: (() => void) | undefined;

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    stopDragging?.();
    const containerSize = handleEl?.parentElement?.clientWidth || 1;
    let startPos = event.clientX;
    stopDragging = startFrameCoalescedPointerDrag((moveEvent) => {
      props.onDrag((moveEvent.clientX - startPos) / containerSize);
      startPos = moveEvent.clientX;
    });
  };

  useAdjustShortcuts({
    edge: (end) => props.onDrag(end === "start" ? -1 : 1),
    root: () => handleEl,
    step: (direction, large) => props.onDrag(direction * (large ? 0.1 : 0.02)),
  });

  onCleanup(() => stopDragging?.());

  return (
    <hr
      aria-label="Resize pane"
      aria-orientation="vertical"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={props.positionPercent}
      class="pane-divider"
      onPointerDown={onPointerDown}
      ref={handleEl}
      tabIndex={0}
    />
  );
}
