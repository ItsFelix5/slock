import { int, pick, type Random } from "@slock/core/testing";
import type { FuzzSuite } from "../../fuzz/fuzzRun";
import { CHANNELS, createUnreadWorld, type UnreadWorld } from "./fuzzUnreadWorld";

export type Action =
  | { kind: "refresh" | "pump" }
  | { kind: "incoming" | "read" | "readElsewhere"; channel: number; mention: boolean };

const KINDS = [
  "incoming",
  "incoming",
  "incoming",
  "read",
  "read",
  "readElsewhere",
  "refresh",
  "pump",
  "pump",
] as const;

const generate = (random: Random): Action[] =>
  Array.from({ length: int(random, 6, 30) }, () => {
    const kind = pick(random, KINDS);
    return kind === "refresh" || kind === "pump"
      ? { kind }
      : { channel: int(random, 0, CHANNELS.length - 1), kind, mention: random() < 0.3 };
  });

const describeAction = (action: Action) =>
  "channel" in action
    ? `${action.kind} ${CHANNELS[action.channel]}${action.mention ? " (mention)" : ""}`
    : action.kind;

async function perform(world: UnreadWorld, action: Action) {
  world.env.advance(250);
  if ("channel" in action) {
    const id = CHANNELS[action.channel];
    if (!id) return;
    if (action.kind === "incoming") world.incoming(id, action.mention);
    else world[action.kind](id);
  } else if (action.kind === "refresh") world.refresh();
  await world.fuzz.pump();
}

function assertNeverNegative(world: UnreadWorld, when: string) {
  for (const id of CHANNELS) {
    const { mentions } = world.channel(id);
    if (!(mentions >= 0)) throw new Error(`${when}: ${id} shows ${mentions} mentions`);
  }
}

function assertMatchesServer(world: UnreadWorld) {
  for (const id of CHANNELS) {
    const shown = world.channel(id);
    const unread = world.server.unread(id) > 0;
    const mentions = world.server.mentions(id);
    if (shown.unread !== unread || shown.mentions !== mentions)
      throw new Error(
        `${id} shows unread=${shown.unread} mentions=${shown.mentions} but the server has unread=${unread} mentions=${mentions}`,
      );
  }
}

export const unreadSuite = (
  name: string,
  rates: Parameters<typeof createUnreadWorld>[2],
  heal: boolean,
): FuzzSuite<Action> => ({
  describe: describeAction,
  generate,
  name,
  run: async ({ actions, seed, trace }) => {
    const world = await createUnreadWorld(seed, trace, rates);
    try {
      for (const action of actions) {
        trace.push(`action ${describeAction(action)}`);
        await perform(world, action);
        assertNeverNegative(world, `after ${describeAction(action)}`);
      }
      await world.settle();
      if (heal) {
        world.refresh();
        await world.settle();
      }
      assertNeverNegative(world, "after settle");
      assertMatchesServer(world);
    } finally {
      await world.stop();
    }
  },
});

export const convergeSuite = unreadSuite(
  "counts converge to the server once settled",
  { dropApi: 0, dropEvent: 0 },
  false,
);

export const healSuite = unreadSuite(
  "a refresh repairs lost events and failed requests",
  { dropApi: 0.02 },
  true,
);
