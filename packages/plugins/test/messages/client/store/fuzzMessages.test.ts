import { describe, test } from "bun:test";
import { int, pick, type Random } from "@slock/core/testing";
import { compareTs } from "@slock/slack";
import type { Message } from "@slock/types";
import { type FuzzSuite, replaySeed, runFuzz } from "../../../fuzz/fuzzRun";
import type { FaultRates } from "../../../fuzz/fuzzSlack";
import { CHANNEL, createMessagesWorld, type MessagesWorld } from "./fuzzMessagesWorld";

type Action =
  | { kind: "say" | "send" | "older" | "recent" | "reconnect" | "pump" }
  | { kind: "editOther" | "removeOther" | "editMine" | "deleteMine"; at: number };

const KINDS = [
  "say",
  "say",
  "say",
  "send",
  "send",
  "editOther",
  "removeOther",
  "editMine",
  "deleteMine",
  "older",
  "recent",
  "reconnect",
  "pump",
  "pump",
] as const;

const generate = (random: Random): Action[] =>
  Array.from({ length: int(random, 4, 20) }, () => {
    const kind = pick(random, KINDS);
    return kind === "editOther" ||
      kind === "removeOther" ||
      kind === "editMine" ||
      kind === "deleteMine"
      ? { at: random(), kind }
      : { kind };
  });

const describeAction = (action: Action) =>
  "at" in action ? `${action.kind} @${action.at.toFixed(2)}` : action.kind;

async function perform(world: MessagesWorld, action: Action) {
  world.env.advance(1000);
  if ("at" in action) world[action.kind](action.at);
  else if (action.kind !== "pump") world[action.kind]();
  await world.fuzz.pump();
}

function assertSortedAndUnique(list: Message[], when: string) {
  const settled = list.filter((m) => !m.pending);
  for (const [i, m] of settled.entries()) {
    const previous = settled[i - 1];
    if (previous && compareTs(previous.ts, m.ts) >= 0)
      throw new Error(`${when}: ${previous.ts} then ${m.ts} is not strictly ascending`);
  }
  if (new Set(settled.map((m) => m.id)).size !== settled.length)
    throw new Error(`${when}: duplicate message ids`);
}

const serverTexts = (world: MessagesWorld) =>
  new Map(world.h.slack.serverMessages(CHANNEL).map((m) => [m.ts, m.text]));

function assertDeliveredSurvive(world: MessagesWorld) {
  const { added, deleted, droppedDeletes } = world.ledger;
  const visible = world.visible();
  const shown = new Set(visible.map((m) => m.ts));
  const server = serverTexts(world);
  if (visible.some((m) => m.pending)) throw new Error("a message is still pending after settle");
  for (const ts of deleted)
    if (shown.has(ts)) throw new Error(`${ts} was deleted by a delivered event but is visible`);
  for (const ts of added)
    if (server.has(ts) && !shown.has(ts)) throw new Error(`delivered message ${ts} is missing`);
  for (const ts of shown)
    if (!(server.has(ts) || droppedDeletes.has(ts)))
      throw new Error(`${ts} is visible but the server no longer has it`);
}

function assertEditsApplied(world: MessagesWorld) {
  const server = serverTexts(world);
  for (const m of world.visible()) {
    const expected = server.get(m.ts);
    if (expected !== undefined && !world.ledger.tainted.has(m.ts) && m.text !== expected)
      throw new Error(`${m.ts} shows "${m.text}" but the server has "${expected}"`);
  }
}

async function healFromServer(world: MessagesWorld) {
  world.reconnect();
  await world.settle();
  for (let page = 0; page < 8 && world.h.store.hasMoreHistory(CHANNEL); page++) {
    world.older();
    await world.settle();
  }
  const shown = new Set<string>(world.visible().map((m) => m.ts));
  for (const ts of serverTexts(world).keys())
    if (!shown.has(ts)) throw new Error(`server message ${ts} is missing after reconnect`);
}

function suite(
  name: string,
  rates: Partial<FaultRates>,
  check: (world: MessagesWorld) => Promise<void> | void,
): FuzzSuite<Action> {
  return {
    describe: describeAction,
    generate,
    name,
    run: async ({ actions, seed, trace }) => {
      const world = await createMessagesWorld(seed, trace, 8 + (seed % 3) * 14, rates);
      try {
        for (const action of actions) {
          trace.push(`action ${describeAction(action)}`);
          await perform(world, action);
          assertSortedAndUnique(world.visible(), `after ${describeAction(action)}`);
        }
        await world.settle();
        await check(world);
      } finally {
        await world.dispose();
      }
    },
  };
}

const survive = suite("delivered messages survive any interleaving", {}, (world) => {
  assertSortedAndUnique(world.visible(), "after settle");
  assertDeliveredSurvive(world);
});
const editsApplied = suite(
  "edits survive stale history responses",
  { dropApi: 0 },
  assertEditsApplied,
);
const reconnectHeals = suite(
  "a reconnect restores everything the server has",
  {},
  async (world) => {
    await healFromServer(world);
    assertSortedAndUnique(world.visible(), "after reconnect");
    assertDeliveredSurvive(world);
  },
);
const reordered = suite(
  "reordered realtime events keep the list sorted and unique",
  { reorderEvents: true },
  (world) => assertSortedAndUnique(world.visible(), "after settle"),
);

describe("messages store fuzz", () => {
  test("delivered messages survive any interleaving", () => runFuzz(survive));
  test("edits survive stale history responses", () => runFuzz(editsApplied));
  test("a reconnect restores everything the server has", () => runFuzz(reconnectHeals));
  test("reordered realtime events keep the list sorted and unique", () => runFuzz(reordered));
});

describe("messages store fuzz regressions", () => {
  test("seed 40: a stale history response does not undo an edit", () =>
    replaySeed(editsApplied, 40));
  test("seed 79: an edit event before the message loads is not lost", () =>
    replaySeed(editsApplied, 79));
  test("seed 32: a stale own-edit confirmation does not override a newer event", () =>
    replaySeed(editsApplied, 32));
});
