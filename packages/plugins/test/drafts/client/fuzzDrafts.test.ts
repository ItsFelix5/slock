import { describe, test } from "bun:test";
import { int, pick, type Random } from "@slock/core/testing";
import { type FuzzSuite, replaySeed, runFuzz } from "../../fuzz/fuzzRun";
import { blocks } from "./composerHarness";
import { CHANNEL, createDraftsWorld, type DraftsWorld } from "./fuzzDraftsWorld";

type Action = { kind: "type" | "clear" | "tick" | "send" | "pump" };

const KINDS = ["type", "type", "type", "clear", "tick", "tick", "send", "pump", "pump"] as const;

const generate = (random: Random): Action[] =>
  Array.from({ length: int(random, 4, 24) }, () => ({ kind: pick(random, KINDS) }));

const describeAction = ({ kind }: Action) => kind;

async function perform(world: DraftsWorld, { kind }: Action) {
  if (kind === "tick") world.tick();
  else if (kind !== "pump") world[kind]();
  await world.fuzz.pump();
}

const shown = (world: DraftsWorld) => JSON.stringify(world.composer.current());

function assertServerHoldsEditor(world: DraftsWorld) {
  const saved = world.server.state.drafts.map((draft) => JSON.stringify(draft.blocks));
  const expected = shown(world) === JSON.stringify(blocks("")) ? [] : [shown(world)];
  if (JSON.stringify(saved) !== JSON.stringify(expected))
    throw new Error(`the server has ${JSON.stringify(saved)} but the editor shows ${expected}`);
}

function assertClientMatchesServer(world: DraftsWorld) {
  const local = (world.composer.store.drafts[CHANNEL] ?? []).map((draft) => draft.id).sort();
  const remote = world.server.state.drafts.map((draft) => draft.id).sort();
  if (local.join() !== remote.join())
    throw new Error(`the client lists drafts [${local}] but the server has [${remote}]`);
}

const suite = (
  name: string,
  rates: Parameters<typeof createDraftsWorld>[2],
): FuzzSuite<Action> => ({
  describe: describeAction,
  generate,
  name,
  run: async ({ actions, seed, trace }) => {
    const world = createDraftsWorld(seed, trace, rates);
    try {
      for (const action of actions) {
        trace.push(`action ${describeAction(action)}`);
        await perform(world, action);
      }
      await world.settle();
      assertServerHoldsEditor(world);
      assertClientMatchesServer(world);
    } finally {
      await world.dispose();
    }
  },
});

const lastWriteWins = suite("the last write wins and nothing comes back after a delete", {
  dropApi: 0,
});
const reordered = suite("reordered realtime events change nothing", {
  dropApi: 0,
  reorderEvents: true,
});

describe("drafts fuzz", () => {
  test("the last write wins and nothing comes back after a delete", () => runFuzz(lastWriteWins));

  test("reordered realtime events change nothing", () => runFuzz(reordered));
});

describe("drafts fuzz regressions", () => {
  test("seed 18: clearing and retyping during a slow first save leaves one draft", () =>
    replaySeed(lastWriteWins, 18));

  test("seed 31: a late update echo does not bring back a deleted draft", () =>
    replaySeed(lastWriteWins, 31));

  test("seed 65: text typed before drafts load after a send is still saved", () =>
    replaySeed(lastWriteWins, 65));
});
