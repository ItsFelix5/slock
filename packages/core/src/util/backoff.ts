import type { Env } from "../types";

type BackoffOptions = {
  base: number;
  max: number;
  factor?: number;
} & ({ jitter?: undefined } | { jitter: number; random: Env["random"] });

export function backoff(attempt: number, options: BackoffOptions): number {
  const delay = Math.min(options.base * (options.factor ?? 2) ** attempt, options.max);
  if (options.jitter === undefined) return delay;
  return Math.round(delay * (1 + (options.random() - 0.5) * 2 * options.jitter));
}
