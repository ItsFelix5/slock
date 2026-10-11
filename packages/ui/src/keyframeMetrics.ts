import { defined } from "@slock/core";
import { objectKeys } from "./media/Icon";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function metricsAt<T extends Record<string, number>>(
  keyframes: [number, T][],
  at: number,
): T {
  const [min] = defined(keyframes[0]);
  const [max] = defined(keyframes[keyframes.length - 1]);
  const clamped = Math.min(max, Math.max(min, at));
  let segmentEnd = keyframes.length - 1;
  for (let i = 1; i < keyframes.length; i += 1) {
    const [frameAt] = defined(keyframes[i]);
    if (clamped <= frameAt) {
      segmentEnd = i;
      break;
    }
  }
  const [fromAt, from] = defined(keyframes[segmentEnd - 1]);
  const [toAt, to] = defined(keyframes[segmentEnd]);
  const t = (clamped - fromAt) / (toAt - fromAt);
  return {
    ...from,
    ...Object.fromEntries(
      objectKeys(from).map((key) => [key, lerp(defined(from[key]), defined(to[key]), t)]),
    ),
  };
}
