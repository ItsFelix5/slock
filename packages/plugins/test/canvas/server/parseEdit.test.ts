import { describe, expect, test } from "bun:test";
import { forAll, int, pick, type Random, text } from "@slock/core/testing";
import { ch, fid, tid, uid } from "@slock/slack/testing";
import type { CanvasControl, CanvasEdit, CanvasNode, LayoutFrame } from "@slock/types";
import { parseCanvasEdit } from "../../../src/canvas/server/parseEdit";

function frames(random: Random): LayoutFrame[] {
  const roll = int(random, 0, 3);
  if (roll === 0) return [{ kind: "quote" }];
  if (roll === 1) return [{ color: int(random, 0, 8), kind: "callout" }];
  if (roll === 2) return [{ id: "c1", index: int(random, 0, 2), kind: "columns", weights: [1, 2] }];
  return [];
}

function node(random: Random, n: number): CanvasNode {
  const id = `s${n}`;
  const roll = int(random, 0, 3);
  if (roll === 0)
    return {
      columns: [{ id: "col:a", width: int(random, 40, 300) }],
      frames: frames(random),
      id,
      kind: "table",
      rows: [{ cells: [{ contentId: `t${n}`, html: text(random, "ab<>", 5) }], id: "w:a" }],
    };
  if (roll === 1)
    return { fileId: fid("F1"), frames: frames(random), id, kind: "file", permalink: "https://x" };
  return {
    checked: int(random, 0, 1) === 1,
    frames: frames(random),
    html: text(random, "abc ", 8),
    id,
    indent: int(random, 0, 3),
    kind: pick(random, ["paragraph", "bullet", "heading", "code", "divider"] as const),
    level: int(random, 0, 6),
  };
}

function control(random: Random, n: number): CanvasControl {
  const id = `k${n}`;
  const roll = int(random, 0, 4);
  if (roll === 0) return { id, kind: "annotation" };
  if (roll === 1) return { id, kind: "user", userId: uid("U1") };
  if (roll === 2) return { id, kind: "emoji", name: "tada", teamId: tid("T1") };
  if (roll === 3) return { id, kind: "date", label: "today", ms: int(random, 0, 1e9) };
  return { channelId: ch("C1"), id, kind: "channel" };
}

function edit(random: Random): CanvasEdit {
  const count = int(random, 0, 5);
  return {
    controls: Array.from({ length: int(random, 0, 3) }, (_, n) => control(random, n)),
    deleted: Array.from({ length: int(random, 0, 3) }, (_, n) => `d${n}`),
    title: int(random, 0, 1) === 1 ? text(random, "abc ", 10) : null,
    upserts: Array.from({ length: count }, (_, n) => ({
      after: n === 0 ? null : `s${n - 1}`,
      node: node(random, n),
    })),
  };
}

const wire = (value: unknown) => JSON.parse(JSON.stringify(value));

describe("parseCanvasEdit", () => {
  test("accepts what the client sends and returns it unchanged", () => {
    forAll(edit, (value) => {
      expect(parseCanvasEdit(wire(value))).toEqual(wire(value));
    });
  });

  test("rejects a payload that is not an object", () => {
    for (const value of [null, undefined, 1, "x", []]) expect(parseCanvasEdit(value)).toBeNull();
  });

  test("rejects every required top level field when it goes missing or changes type", () => {
    const valid = wire(edit(() => 0.5));
    for (const key of ["controls", "deleted", "upserts", "title"]) {
      const { [key]: _removed, ...rest } = valid;
      expect(parseCanvasEdit(rest)).toBeNull();
      expect(parseCanvasEdit({ ...valid, [key]: 7 })).toBeNull();
    }
  });

  test("rejects a bad node anywhere in the list", () => {
    forAll(
      (random) => ({ at: int(random, 0, 3), value: edit(random) }),
      ({ at, value }) => {
        const payload = wire({
          ...value,
          upserts: [
            ...Array.from({ length: at }, (_, n) => ({ after: null, node: node(() => 0.9, n) })),
            { after: null, node: { id: "bad", kind: "paragraph" } },
          ],
        });
        expect(parseCanvasEdit(payload)).toBeNull();
      },
      50,
    );
  });

  test("rejects ids with the wrong shape", () => {
    const base = wire(edit(() => 0.5));
    const user = { id: "k", kind: "user", userId: "not an id" };
    const file = {
      after: null,
      node: { fileId: "nope", frames: [], id: "s", kind: "file", permalink: "p" },
    };
    expect(parseCanvasEdit({ ...base, controls: [user] })).toBeNull();
    expect(parseCanvasEdit({ ...base, upserts: [file] })).toBeNull();
  });

  test("rejects a non finite number and a fractional integer field", () => {
    const base = wire(edit(() => 0.5));
    const date = { id: "k", kind: "date", label: "l", ms: null };
    const line = (indent: number) => ({
      after: null,
      node: {
        checked: false,
        frames: [],
        html: "",
        id: "s",
        indent,
        kind: "paragraph",
        level: 0,
      },
    });
    expect(parseCanvasEdit({ ...base, controls: [date] })).toBeNull();
    expect(parseCanvasEdit({ ...base, upserts: [line(1.5)] })).toBeNull();
    expect(parseCanvasEdit({ ...base, upserts: [line(1)] })).not.toBeNull();
  });
});
