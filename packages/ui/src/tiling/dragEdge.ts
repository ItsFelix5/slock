export type EdgeZone = "top" | "right" | "bottom" | "left" | "center";

interface EdgeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Picks whichever edge the pointer is closest to; "center" if it's not
// within edgeFraction of any edge (i.e. drop here replaces content in place).
export function detectEdgeZone(
  rect: EdgeRect,
  x: number,
  y: number,
  edgeFraction = 0.25,
): EdgeZone {
  if (rect.width <= 0 || rect.height <= 0) return "center";
  const relX = (x - rect.left) / rect.width;
  const relY = (y - rect.top) / rect.height;
  const candidates: [EdgeZone, number][] = [
    ["left", relX],
    ["right", 1 - relX],
    ["top", relY],
    ["bottom", 1 - relY],
  ];
  const [zone, distance] = candidates.reduce((min, cur) => (cur[1] < min[1] ? cur : min));
  return distance < edgeFraction ? zone : "center";
}
