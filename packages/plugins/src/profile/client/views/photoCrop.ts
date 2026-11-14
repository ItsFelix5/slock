export type Crop = { size: number; x: number; y: number };
export type Dimensions = { height: number; width: number };
export type Corner = { x: -1 | 1; y: -1 | 1 };

const MIN_CROP_PIXELS = 64;
const MAX_CROP_SCALE = 1.6;
const OVERHANG = 0.18;
const SNAP_RATIO = 0.04;
const KEY_STEP_RATIO = 0.02;

export function initialCrop({ height, width }: Dimensions): Crop {
  const size = Math.min(width, height);
  return { size, x: (width - size) / 2, y: (height - size) / 2 };
}

function clampAxis(position: number, length: number, size: number): number {
  const min = -size * OVERHANG;
  const max = length - size * (1 - OVERHANG);
  return min > max ? (min + max) / 2 : Math.max(min, Math.min(position, max));
}

export function constrainCrop(value: Crop, source: Dimensions): Crop {
  const minSize = Math.min(MIN_CROP_PIXELS, source.width, source.height);
  const size = Math.max(
    minSize,
    Math.min(value.size, Math.max(source.width, source.height) * MAX_CROP_SCALE),
  );
  const snapDistance = Math.min(source.width, source.height) * SNAP_RATIO;
  let x = clampAxis(value.x, source.width, size);
  let y = clampAxis(value.y, source.height, size);
  if (Math.abs(x) < snapDistance) x = 0;
  if (Math.abs(y) < snapDistance) y = 0;
  if (Math.abs(x + size - source.width) < snapDistance) x = source.width - size;
  if (Math.abs(y + size - source.height) < snapDistance) y = source.height - size;
  return { size, x, y };
}

export function cornerAnchor(crop: Crop, corner: Corner) {
  return {
    x: corner.x === -1 ? crop.x + crop.size : crop.x,
    y: corner.y === -1 ? crop.y + crop.size : crop.y,
  };
}

export function resizeFromAnchor(
  anchor: { x: number; y: number },
  corner: Corner,
  point: { x: number; y: number },
): Crop {
  const size = Math.max(Math.abs(point.x - anchor.x), Math.abs(point.y - anchor.y));
  return {
    size,
    x: corner.x === -1 ? anchor.x - size : anchor.x,
    y: corner.y === -1 ? anchor.y - size : anchor.y,
  };
}

export function nudgeCrop(
  crop: Crop,
  key: string,
  resize: boolean,
  source: Dimensions,
): Crop | undefined {
  const step = Math.max(1, Math.round(Math.min(source.width, source.height) * KEY_STEP_RATIO));
  const direction = {
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
  }[key];
  if (!direction) return;
  if (!resize)
    return constrainCrop(
      { ...crop, x: crop.x + direction.x * step, y: crop.y + direction.y * step },
      source,
    );
  const growth = (direction.x + direction.y) * step * 2;
  return constrainCrop(
    { size: crop.size + growth, x: crop.x - growth / 2, y: crop.y - growth / 2 },
    source,
  );
}

export function cropDrawRect(crop: Crop, source: Dimensions, outputSize: number) {
  const left = Math.max(0, crop.x);
  const top = Math.max(0, crop.y);
  const right = Math.min(source.width, crop.x + crop.size);
  const bottom = Math.min(source.height, crop.y + crop.size);
  if (right <= left || bottom <= top) return;
  const scale = outputSize / crop.size;
  return {
    destHeight: (bottom - top) * scale,
    destWidth: (right - left) * scale,
    destX: (left - crop.x) * scale,
    destY: (top - crop.y) * scale,
    sourceHeight: bottom - top,
    sourceWidth: right - left,
    sourceX: left,
    sourceY: top,
  };
}

export function profilePhotoName(name: string) {
  const dot = name.lastIndexOf(".");
  return `${dot > 0 ? name.slice(0, dot) : name}-profile.png`;
}
