import { objectKeys } from "./media/Icon";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function metricsAt<T extends Record<string, number>>(
  keyframes: [number, T][],
  at: number,
): T {
  const [min] = keyframes[0];
  const [max] = keyframes[keyframes.length - 1];
  const clamped = Math.min(max, Math.max(min, at));
  let segmentEnd = keyframes.length - 1;
  for (let i = 1; i < keyframes.length; i += 1) {
    const [frameAt] = keyframes[i];
    if (clamped <= frameAt) {
      segmentEnd = i;
      break;
    }
  }
  const [fromAt, from] = keyframes[segmentEnd - 1];
  const [toAt, to] = keyframes[segmentEnd];
  const t = (clamped - fromAt) / (toAt - fromAt);
  const result: any = {};
  for (const key of objectKeys(from)) {
    result[key] = lerp(from[key], to[key], t);
  }
  return result;
}
