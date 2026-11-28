import { createRoot, flush, OBSERVE } from "solid-js";
import { type Random, seededRandom } from "./fake/seededRandom";

export { createFakeEnv, type FakeEnv } from "./fake/fakeEnv";
export { type Random, seededRandom } from "./fake/seededRandom";

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

export function partialService<Service extends object>(members: Partial<Service>): Service {
  return Object.assign(Object.create(null), members);
}

type TestRoot<T> = { value: T; dispose: () => void };

export function inRoot<T>(create: () => T): TestRoot<T> {
  let dispose = () => {};
  const value = createRoot((d) => {
    dispose = d;
    return create();
  });
  flush();
  return { value, dispose };
}

const FAILING_DIAGNOSTICS = new Set(["STRICT_READ_UNTRACKED", "REACTIVE_WRITE_IN_OWNED_SCOPE"]);

export function trackSolidDiagnostics(): () => string[] {
  const findings: string[] = [];
  OBSERVE?.diagnostics.subscribe((event) => {
    if (!FAILING_DIAGNOSTICS.has(event.code)) return;
    findings.push(
      event.ownerPath ? `${event.message} in ${event.ownerPath.join(" > ")}` : event.message,
    );
  });
  return () => findings.splice(0);
}
