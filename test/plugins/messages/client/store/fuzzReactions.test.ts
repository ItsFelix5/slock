import { describe, test } from "bun:test";
import { int, pick, type Random } from "../../../../support/core";
import { type FuzzSuite, replaySeed, runFuzz } from "../../../fuzz/fuzzRun";
import { CHANNEL, createMessagesWorld, type MessagesWorld } from "./fuzzMessagesWorld";
import { ME } from "./storeHarness";

const EMOJI = ["tada", "eyes", "wave"] as const;

type Action =
  | { kind: "say" | "recent" | "reconnect" | "pump" }
  | { kind: "reactMine" | "reactOther"; at: number; name: (typeof EMOJI)[number] };

const KINDS = [
  "reactMine",
  "reactMine",
  "reactMine",
  "reactMine",
  "reactOther",
  "reactOther",
  "say",
  "recent",
  "reconnect",
  "pump",
  "pump",
] as const;

const generate = (random: Random): Action[] =>
  Array.from({ length: int(random, 6, 28) }, () => {
    const kind = pick(random, KINDS);
    return kind === "reactMine" || kind === "reactOther"
      ? { at: random(), kind, name: pick(random, EMOJI) }
      : { kind };
  });

const describeAction = (action: Action) =>
  "at" in action ? `${action.kind} ${action.name} @${action.at.toFixed(2)}` : action.kind;

async function perform(world: MessagesWorld, action: Action) {
  world.env.advance(1000);
  if ("at" in action) world[action.kind](action.at, action.name);
  else if (action.kind !== "pump") world[action.kind]();
  await world.fuzz.pump();
}

const sorted = (users: readonly string[]) => [...users].sort().join(",");

function assertMatchesServer(world: MessagesWorld) {
  for (const m of world.visible()) {
    for (const name of EMOJI) {
      const shown = m.reactions?.find((r) => r.name === name);
      const server = world.h.slack.reactionUsers(CHANNEL, m.ts, name);
      if (sorted(shown?.users ?? []) !== sorted(server))
        throw new Error(
          `${m.ts} :${name}: shows [${sorted(shown?.users ?? [])}] but the server has [${sorted(server)}]`,
        );
      if (shown && shown.count !== shown.users.length)
        throw new Error(`${m.ts} :${name}: count ${shown.count} for ${shown.users.length} users`);
    }
  }
}

function assertLastIntentWon(world: MessagesWorld) {
  for (const { name, ts, wanted } of world.intents.values()) {
    const has = world.h.slack.reactionUsers(CHANNEL, ts, name).includes(ME);
    if (has !== wanted)
      throw new Error(`${ts} :${name}: last intent was ${wanted} but the server has ${has}`);
  }
}

const reactionSuite = (name: string, check: (world: MessagesWorld) => void): FuzzSuite<Action> => ({
  describe: describeAction,
  generate,
  name,
  run: async ({ actions, seed, trace }) => {
    const world = await createMessagesWorld(seed, trace, 6, { dropApi: 0, dropEvent: 0 });
    try {
      for (const action of actions) {
        trace.push(`action ${describeAction(action)}`);
        await perform(world, action);
      }
      await world.settle();
      check(world);
    } finally {
      await world.dispose();
    }
  },
});

const lastToggleWins = reactionSuite("the last toggle wins on the server", assertLastIntentWon);
const clientMatchesServer = reactionSuite(
  "the client shows what the server has once settled",
  assertMatchesServer,
);

describe("reaction fuzz", () => {
  test("the last toggle wins on the server", () => runFuzz(lastToggleWins));

  test("the client shows what the server has once settled", () => runFuzz(clientMatchesServer));

  test("seed 3: a stale history response does not undo a live reaction", () =>
    replaySeed(clientMatchesServer, 3));
});
