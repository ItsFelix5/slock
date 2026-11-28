import { describe, expect, test } from "bun:test";
import type { CanvasNode } from "@slock/types";
import { diffNodes } from "../../../../packages/plugins/src/canvas/protocol/diff.ts";
import { longestIncreasing } from "../../../../packages/plugins/src/canvas/protocol/increasing.ts";
import { forAll, int } from "../../../support/core";
import { sectionId } from "./canvasSimulator.ts";

function node(n: number, html = `t${n}`): CanvasNode {
  return {
    checked: false,
    frames: [],
    html,
    id: sectionId(n),
    indent: 0,
    kind: "paragraph",
    level: 0,
  };
}

describe("diffNodes", () => {
  test("commenting on text is not a change", () => {
    const entries = diffNodes(
      [node(1, "<b>hi there</b>"), node(2, "plain")],
      [
        node(1, '<b>hi </b><annotation id="c1"><b>there</b></annotation>'),
        node(2, '<annotation id="c2">plain</annotation>'),
      ],
    );

    expect(entries.map((entry) => entry.status)).toEqual(["same", "same"]);
    expect(entries.map((entry) => "html" in entry.node && entry.node.html)).toEqual([
      "<b>hi there</b>",
      "plain",
    ]);
  });

  test("marks added, changed, removed and same in reading order", () => {
    const entries = diffNodes([node(1), node(2), node(3)], [node(1), node(2, "edited"), node(4)]);
    expect(entries.map((entry) => [entry.node.id.slice(-1), entry.status])).toEqual([
      ["1", "same"],
      ["2", "changed"],
      ["3", "removed"],
      ["4", "added"],
    ]);
  });

  test("removed nodes at the start come first", () => {
    const entries = diffNodes([node(1), node(2)], [node(2)]);
    expect(entries.map((entry) => entry.status)).toEqual(["removed", "same"]);
  });

  test("a frame change counts as changed", () => {
    const quoted = { ...node(1), frames: [{ kind: "quote" as const }] };
    expect(diffNodes([node(1)], [quoted])[0]?.status).toBe("changed");
  });

  test("every next node appears exactly once and every removed node appears once", () => {
    forAll(
      (random) => {
        const pool = Array.from({ length: 8 }, (_, i) => node(i + 1));
        const pickSome = () => pool.filter(() => int(random, 0, 1) === 1);
        return { next: pickSome(), previous: pickSome() };
      },
      ({ next, previous }) => {
        const entries = diffNodes(previous, next);
        const nextIds = new Set(next.map((n) => n.id));
        expect(entries.filter((e) => e.status !== "removed").map((e) => e.node.id)).toEqual(
          next.map((n) => n.id),
        );
        expect(
          entries
            .filter((e) => e.status === "removed")
            .map((e) => e.node.id)
            .sort(),
        ).toEqual(
          previous
            .filter((n) => !nextIds.has(n.id))
            .map((n) => n.id)
            .sort(),
        );
      },
    );
  });
});

describe("longestIncreasing", () => {
  test("skips nulls and keeps a longest run", () => {
    const kept = longestIncreasing([3, null, 1, 2, 5, 4], (a, b) => a < b);
    expect(kept.size).toBe(3);
    expect(kept.has(1)).toBe(false);
  });

  test("kept values are strictly increasing and maximal", () => {
    forAll(
      (random) =>
        Array.from({ length: int(random, 0, 12) }, () =>
          int(random, 0, 4) === 0 ? null : int(random, 0, 9),
        ),
      (values) => {
        const kept = [...longestIncreasing(values, (a, b) => a < b)].sort((a, b) => a - b);
        const picked = kept.map((index) => values[index] ?? 0);
        for (const [i, value] of picked.slice(1).entries()) {
          expect(value > (picked[i] ?? 0)).toBe(true);
        }
        const best = values.reduce<number[]>((tails, value) => {
          if (value === null) return tails;
          const at = tails.findIndex((tail) => tail >= value);
          if (at < 0) tails.push(value);
          else tails[at] = value;
          return tails;
        }, []);
        expect(kept.length).toBe(best.length);
      },
    );
  });
});
