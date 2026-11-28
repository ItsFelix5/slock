import { describe, expect, test } from "bun:test";
import { int, pick, type Random, seededRandom, text } from "../../../support/core";
import { editOf, sectionId } from "../protocol/canvasSimulator";
import { createSyncHarness, type EditorLine, type SyncHarness, settle } from "./syncHarness";

const ALPHABET = "abc XYZ 012 é中";

type Action =
  | "type"
  | "enter"
  | "paste"
  | "delete"
  | "swap"
  | "flush"
  | "release"
  | "hold"
  | "fail"
  | "pull"
  | "theirType"
  | "theirInsert"
  | "theirDelete";

const ACTIONS: Action[] = [
  "type",
  "type",
  "enter",
  "paste",
  "delete",
  "swap",
  "flush",
  "release",
  "hold",
  "fail",
  "pull",
  "pull",
  "theirType",
  "theirInsert",
  "theirDelete",
];

function mutate(random: Random, lines: EditorLine[], action: Action): EditorLine[] {
  const next = lines.map((line) => ({ ...line }));
  const at = int(random, 0, Math.max(0, next.length - 1));
  const line = next[at];
  if (action === "type" && line) line.text = text(random, ALPHABET, 8);
  if (action === "enter")
    next.splice(at + 1, 0, { sid: line?.sid ?? null, text: text(random, ALPHABET, 5) });
  if (action === "paste" && line) next.splice(int(random, 0, next.length), 0, { ...line });
  if (action === "delete" && next.length > 1) next.splice(at, 1);
  if (action === "swap" && next.length > 1) {
    const other = (at + 1) % next.length;
    const a = next[at];
    const b = next[other];
    if (a && b) [next[at], next[other]] = [b, a];
  }
  return next;
}

function someoneElse(random: Random, h: SyncHarness, action: Action, step: number) {
  const nodes = h.server.nodes();
  const at = int(random, 0, Math.max(0, nodes.length - 1));
  const node = nodes[at];
  if (action === "theirDelete" && node && nodes.length > 1)
    h.server.apply(editOf({ deleted: [node.id] }));
  if (!(node && "html" in node)) return;
  const html = text(random, ALPHABET, 8);
  if (action === "theirType")
    h.server.apply(
      editOf({ upserts: [{ after: nodes[at - 1]?.id ?? null, node: { ...node, html } }] }),
    );
  if (action === "theirInsert")
    h.server.apply(
      editOf({
        upserts: [{ after: node.id, node: { ...node, html, id: sectionId(1000 + step) } }],
      }),
    );
}

async function run(seed: number) {
  const random = seededRandom(seed);
  const h = createSyncHarness(["alpha", "beta", "gamma"]);
  let release: (() => void) | null = null;
  const log: string[] = [];
  for (let step = 0; step < int(random, 3, 20); step++) {
    const action = pick(random, ACTIONS);
    log.push(action);
    if (action === "flush") void h.sync.flush();
    else if (action === "hold" && !release) release = h.hold();
    else if (action === "release" && release) {
      release();
      release = null;
    } else if (action === "fail") h.failNext("network");
    else if (action === "pull") h.sync.receive(h.copy());
    else if (action.startsWith("their")) someoneElse(random, h, action, step);
    else if (action !== "hold" && action !== "release")
      h.setLines(mutate(random, h.lines(), action));
    await settle();
  }
  release?.();
  h.failNext();
  await h.quiesce();
  h.sync.receive(h.copy());
  await h.quiesce();
  return { h, log };
}

function check(h: SyncHarness, log: string[], seed: number) {
  const where = `seed ${seed}: ${log.join(",")}`;
  expect(h.serverTexts(), where).toEqual(h.lines().map((line) => line.text));
  expect(
    h.lines().every((line) => line.sid !== null),
    where,
  ).toBe(true);
  expect(h.serverIds(), where).toEqual(h.lines().map((line) => line.sid ?? ""));
  expect(new Set(h.serverIds()).size, where).toBe(h.serverIds().length);
}

describe("random editing sessions", () => {
  test("the server ends up with exactly what the editor shows", async () => {
    for (let seed = 1; seed <= 400; seed++) {
      const { h, log } = await run(seed);
      check(h, log, seed);
    }
  }, 60_000);
});
