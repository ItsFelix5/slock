type Rng = () => number;

function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const random: Rng = mulberry32(Number(process.env.CHAOS_SEED ?? 1337));
export const int = (min: number, max: number): number =>
  min + Math.floor(random() * (max - min + 1));
export const chance = (p: number): boolean => random() < p;
export const uid = (): string => random().toString(36).slice(2, 10);

export function pick<T>(items: readonly T[]): T {
  const item = items[int(0, items.length - 1)];
  if (item === undefined) throw new Error("pick from an empty list");
  return item;
}

export function weighted<T>(entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [item, weight] of entries) {
    roll -= weight;
    if (roll < 0) return item;
  }
  return pick(entries)[0];
}
