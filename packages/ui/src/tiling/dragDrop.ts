import { type Accessor, createSignal } from "solid-js";
import { detectEdgeZone, type EdgeZone } from "./dragEdge";

export interface DragSource<T> {
  payload: Accessor<T | null>;
  start: (event: DragEvent, value: T) => void;
  end: () => void;
}

export function createDragSource<T>(): DragSource<T> {
  const [payload, setPayload] = createSignal<T | null>(null);
  return {
    payload,
    start: (event, value) => {
      setPayload(() => value);
      event.dataTransfer?.setData("text/plain", "");
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    },
    end: () => setPayload(null),
  };
}

export interface DropZone {
  hoverZone: Accessor<EdgeZone | null>;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent) => void;
}

export function createDropZone<T>(
  source: DragSource<T>,
  handleDrop: (payload: T, zone: EdgeZone) => void,
  edgeFraction = 0.25,
): DropZone {
  const [hoverZone, setHoverZone] = createSignal<EdgeZone | null>(null);
  return {
    hoverZone,
    onDragOver: (event) => {
      if (!source.payload()) return;
      event.preventDefault();
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      setHoverZone(detectEdgeZone(rect, event.clientX, event.clientY, edgeFraction));
    },
    onDragLeave: () => setHoverZone(null),
    onDrop: (event) => {
      event.preventDefault();
      const zone = hoverZone();
      const value = source.payload();
      setHoverZone(null);
      source.end();
      if (value && zone) handleDrop(value, zone);
    },
  };
}
