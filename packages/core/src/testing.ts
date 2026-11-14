export type Random = () => number;

export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function int(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function pick<T>(random: Random, items: readonly T[]): T {
  const item = items[int(random, 0, items.length - 1)];
  if (item === undefined) throw new Error("pick from an empty list");
  return item;
}

export function text(random: Random, alphabet: string, maxLength = 20): string {
  const chars = [...alphabet];
  return Array.from({ length: int(random, 0, maxLength) }, () => pick(random, chars)).join("");
}

function propertyFailure(seed: number, value: unknown, cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(`property failed for seed ${seed}: ${JSON.stringify(value)}\n${detail}`, {
    cause,
  });
}

export function forAll<T>(
  generate: (random: Random) => T,
  property: (value: T) => void,
  runs = 300,
): void {
  for (let seed = 1; seed <= runs; seed++) {
    const value = generate(seededRandom(seed));
    try {
      property(value);
    } catch (cause) {
      throw propertyFailure(seed, value, cause);
    }
  }
}

export async function forAllAsync<T>(
  generate: (random: Random) => T,
  property: (value: T) => Promise<void>,
  runs = 50,
): Promise<void> {
  for (let seed = 1; seed <= runs; seed++) {
    const value = generate(seededRandom(seed));
    try {
      await property(value);
    } catch (cause) {
      throw propertyFailure(seed, value, cause);
    }
  }
}

export function partialService<Service>(members: Partial<Service>): Service {
  return members as Service;
}
