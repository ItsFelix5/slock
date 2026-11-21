import { type Random, seededRandom } from "@slock/core/testing";

const DEFAULT_SEEDS = 50;

export type FuzzSuite<Action> = {
  describe: (action: Action) => string;
  generate: (random: Random) => Action[];
  name: string;
  run: (job: { actions: Action[]; seed: number; trace: string[] }) => Promise<void>;
  seeds?: number;
};

type Outcome = { error: unknown; trace: string[] };

const seedsToRun = (count: number) => {
  const only = Number(process.env.FUZZ_SEED);
  if (only) return [only];
  const total = Number(process.env.FUZZ_SEEDS) || count;
  return Array.from({ length: total }, (_, i) => i + 1);
};

async function attempt<Action>(
  suite: FuzzSuite<Action>,
  seed: number,
  actions: Action[],
): Promise<Outcome | undefined> {
  const trace: string[] = [];
  const log = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("Failed to")) return;
    log(...args);
  };
  let outcome: Outcome | undefined;
  try {
    await suite.run({ actions, seed, trace });
  } catch (error) {
    outcome = { error, trace };
  } finally {
    console.error = log;
  }
  return outcome;
}

async function shrink<Action>(
  suite: FuzzSuite<Action>,
  seed: number,
  actions: Action[],
  first: Outcome,
) {
  let best = { actions, outcome: first };
  for (let chunk = Math.ceil(actions.length / 2); chunk >= 1; chunk = Math.floor(chunk / 2)) {
    for (let start = 0; start < best.actions.length; ) {
      const candidate = [...best.actions.slice(0, start), ...best.actions.slice(start + chunk)];
      const outcome = await attempt(suite, seed, candidate);
      if (outcome) best = { actions: candidate, outcome };
      else start += chunk;
    }
  }
  return best;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function report<Action>(
  suite: FuzzSuite<Action>,
  seed: number,
  total: number,
  actions: Action[],
  outcome: Outcome,
) {
  const script = actions.map((action, i) => `  ${i + 1}. ${suite.describe(action)}`).join("\n");
  return new Error(
    [
      `fuzz "${suite.name}" failed for seed ${seed}: ${messageOf(outcome.error)}`,
      `rerun: FUZZ_SEED=${seed} bun test --conditions browser --conditions development -t "${suite.name}"`,
      `actions (${actions.length} of ${total} after shrinking):`,
      script,
      "trace:",
      ...outcome.trace.map((line) => `  ${line}`),
    ].join("\n"),
    { cause: outcome.error },
  );
}

export async function runFuzz<Action>(suite: FuzzSuite<Action>) {
  for (const seed of seedsToRun(suite.seeds ?? DEFAULT_SEEDS)) {
    const actions = suite.generate(seededRandom(seed));
    const failed = await attempt(suite, seed, actions);
    if (!failed) continue;
    const best = await shrink(suite, seed, actions, failed);
    throw report(suite, seed, actions.length, best.actions, best.outcome);
  }
}

export const replaySeed = <Action>(suite: FuzzSuite<Action>, seed: number) =>
  replayFuzz(suite, seed, suite.generate(seededRandom(seed)));

export async function replayFuzz<Action>(
  suite: FuzzSuite<Action>,
  seed: number,
  actions: Action[],
) {
  const failed = await attempt(suite, seed, actions);
  if (failed) throw report(suite, seed, actions.length, actions, failed);
}
