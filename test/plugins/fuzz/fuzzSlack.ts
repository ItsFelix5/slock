import { type FakeEnv, type Random, seededRandom } from "../../support/core";

export type FaultRates = {
  delay: number;
  dropApi: number;
  dropEvent: number;
  duplicate: number;
  reorderEvents: boolean;
};

const DEFAULT_RATES: FaultRates = {
  delay: 0.5,
  dropApi: 0.05,
  dropEvent: 0.06,
  duplicate: 0.12,
  reorderEvents: false,
};

type Held = { label: string; release: () => void };
type Queued = { held: boolean; label: string; run: () => void };

export type ServedCall = { body: unknown; method: string; path: string; reply: unknown };

const macrotask = () => new Promise<void>((resolve) => setImmediate(resolve));

export async function quiesce() {
  for (let i = 0; i < 3; i++) {
    for (let tick = 0; tick < 100; tick++) await Promise.resolve();
    await macrotask();
  }
}

const failure = () =>
  new Response(JSON.stringify({ error: "fuzz_dropped", ok: false }), {
    headers: { "content-type": "application/json" },
    status: 500,
  });

export function createFuzz(options: {
  env: FakeEnv;
  onServed?: (call: ServedCall) => void;
  rates?: Partial<FaultRates>;
  seed: number;
  trace: string[];
}) {
  const { env, trace } = options;
  const rates = { ...DEFAULT_RATES, ...options.rates };
  const random: Random = seededRandom(options.seed * 7919 + 17);
  const gates: Held[] = [];
  const queue: Queued[] = [];
  let faulty = true;

  const roll = (probability: number) => faulty && random() < probability;
  const note = (line: string) => void trace.push(line);

  function gate(label: string) {
    note(`hold ${label}`);
    return new Promise<void>((resolve) => {
      gates.push({ label, release: resolve });
    });
  }

  function shuffled<T>(items: T[]) {
    return items
      .map((item) => ({ item, key: random() }))
      .sort((a, b) => a.key - b.key)
      .map(({ item }) => item);
  }

  function takeOpen() {
    const taken: Queued[] = [];
    if (rates.reorderEvents) {
      for (const item of queue.filter((candidate) => !candidate.held)) {
        queue.splice(queue.indexOf(item), 1);
        taken.push(item);
      }
      return shuffled(taken);
    }
    const firstHeld = queue.findIndex((candidate) => candidate.held);
    return queue.splice(0, firstHeld === -1 ? queue.length : firstHeld);
  }

  function deliver(items: Queued[]) {
    for (const item of items) {
      note(`deliver ${item.label}`);
      item.run();
    }
  }

  function flushOpen() {
    deliver(takeOpen());
  }

  function emit(label: string, run: () => void) {
    if (roll(rates.dropEvent)) {
      note(`drop event ${label}`);
      return false;
    }
    const copies = roll(rates.duplicate) ? 2 : 1;
    for (let i = 0; i < copies; i++)
      queue.push({ held: roll(rates.delay), label: i ? `${label} (duplicate)` : label, run });
    flushOpen();
    return true;
  }

  const inner = env.fetch;
  env.fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const url = new URL(typeof input === "string" ? input : String(input), "http://slack.test");
    const label = `${method} ${url.pathname}${url.search}`;
    if (roll(rates.delay)) await gate(`request ${label}`);
    if (roll(rates.dropApi)) {
      note(`drop request ${label}`);
      return failure();
    }
    const response = await inner(input, init);
    options.onServed?.({
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      method,
      path: url.pathname,
      reply: await response.clone().json(),
    });
    if (roll(rates.delay)) await gate(`response ${label}`);
    if (roll(rates.dropApi)) {
      note(`drop response ${label}`);
      return failure();
    }
    return response;
  }, inner);

  async function pump() {
    for (const held of shuffled(gates.splice(0))) {
      if (random() < 0.4) {
        note(`release ${held.label}`);
        held.release();
      } else gates.push(held);
    }
    for (const item of queue) if (item.held && random() < 0.4) item.held = false;
    flushOpen();
    await quiesce();
  }

  async function drain() {
    faulty = false;
    for (let round = 0; round < 50; round++) {
      for (const item of queue) item.held = false;
      flushOpen();
      for (const held of gates.splice(0)) {
        note(`release ${held.label}`);
        held.release();
      }
      await quiesce();
      if (gates.length === 0 && queue.length === 0) return;
    }
    throw new Error("fuzz drain did not converge");
  }

  return { drain, emit, note, pending: () => gates.length + queue.length, pump, random, trace };
}
