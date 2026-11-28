import { describe, expect, test } from "bun:test";
import { backoff } from "../../../packages/plugins/src/realtime/protocol/backoff";
import { createFakeEnv } from "../../support/core";

describe("backoff", () => {
  const options = { base: 1000, max: 30_000 };

  test("starts at the base and doubles", () => {
    expect([0, 1, 2, 3].map((attempt) => backoff(attempt, options))).toEqual([
      1000, 2000, 4000, 8000,
    ]);
  });

  test("stops growing at the cap", () => {
    expect(backoff(5, options)).toBe(30_000);
    expect(backoff(1000, options)).toBe(30_000);
  });

  test("grows by a custom factor", () => {
    expect(backoff(2, { ...options, factor: 3 })).toBe(9000);
  });

  test("is deterministic without jitter", () => {
    expect(backoff(3, options)).toBe(backoff(3, options));
  });

  test("spreads within the jitter fraction using the given random", () => {
    expect(backoff(1, { ...options, jitter: 0.3, random: () => 0 })).toBe(1400);
    expect(backoff(1, { ...options, jitter: 0.3, random: () => 0.5 })).toBe(2000);
    expect(backoff(1, { ...options, jitter: 0.3, random: () => 1 })).toBe(2600);
  });

  test("jitter draws from the env random", () => {
    const env = createFakeEnv(9);
    const again = createFakeEnv(9);
    const delays = [0, 1, 2].map((attempt) =>
      backoff(attempt, { ...options, jitter: 0.3, random: env.random }),
    );
    expect(delays).toEqual(
      [0, 1, 2].map((attempt) =>
        backoff(attempt, { ...options, jitter: 0.3, random: again.random }),
      ),
    );
    for (const [attempt, delay] of delays.entries()) {
      const nominal = backoff(attempt, options);
      expect(delay).toBeGreaterThanOrEqual(nominal * 0.7);
      expect(delay).toBeLessThanOrEqual(nominal * 1.3);
    }
  });
});
