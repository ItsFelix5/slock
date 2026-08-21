import { createSignal } from "solid-js";

export interface DragSplitTarget {
  channelId: string;
  ts?: string;
}

const [dragSplitTarget, setDragSplitTarget] = createSignal<DragSplitTarget | null>(null);

export { dragSplitTarget };

export function beginDragSplit(target: DragSplitTarget) {
  setDragSplitTarget(target);
}

export function endDragSplit() {
  setDragSplitTarget(null);
}

// Spread onto whatever a row's real root element is (button/div/etc) - not
// a wrapper span, since display:contents wrappers (like SplitNavigation)
// don't get a real box and drag-and-drop needs one to hit-test against.
export function splitDragProps(target: DragSplitTarget) {
  return {
    draggable: true,
    onDragEnd: () => endDragSplit(),
    onDragStart: (event: DragEvent) => {
      event.dataTransfer?.setData("text/plain", "");
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
      beginDragSplit(target);
    },
  };
}
