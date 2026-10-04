import { longestIncreasing } from "./increasing.ts";
import { positionBetween } from "./positions.ts";

export function assignPositions(
  existing: (string | null)[],
  floor: string | null,
  used: Set<string>,
): string[] {
  const usable = existing.map((value) =>
    value !== null && (floor === null || value > floor) ? value : null,
  );
  const kept = longestIncreasing(usable, (a, b) => a < b);
  const out: string[] = [];
  let prev = floor;
  existing.forEach((value, index) => {
    if (kept.has(index) && value !== null) {
      out.push(value);
      prev = value;
      return;
    }
    let upper: string | null = null;
    for (let next = index + 1; next < existing.length; next++) {
      if (kept.has(next)) {
        upper = existing[next] ?? null;
        break;
      }
    }
    const position = positionBetween(prev, upper, used);
    out.push(position);
    prev = position;
  });
  return out;
}
