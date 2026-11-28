import type { PaneSide } from "../api/types";

const EDGE_FRACTION = 0.25;

export function dropZone(pane: Pick<DOMRect, "left" | "top" | "width" | "height">, x: number) {
  const ratio = (x - pane.left) / pane.width;
  const side: PaneSide =
    ratio < EDGE_FRACTION ? "before" : ratio > 1 - EDGE_FRACTION ? "after" : "over";
  const width = side === "over" ? pane.width : pane.width / 2;
  const left = side === "after" ? pane.left + width : pane.left;
  return { height: pane.height, left, side, top: pane.top, width };
}
