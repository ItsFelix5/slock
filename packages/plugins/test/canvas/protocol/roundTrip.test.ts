import { describe, expect, test } from "bun:test";
import { forAll, int, pick, type Random, text } from "@slock/core/testing";
import type { CanvasEdit, CanvasNode, LayoutFrame } from "@slock/types";
import { editOf, Server, sectionId } from "../../../src/canvas/protocol/canvasSimulator.ts";
import { escapeCanvasHtml } from "../../../src/canvas/protocol/sectionWrite.ts";

const ALPHABET = "abc XYZ 012 <>&\"' \u{1F600}‍\u{1F468}אבé中\n";
const LIST_KINDS = ["bullet", "ordered", "checklist"] as const;
const LINE_KINDS = ["paragraph", "heading", "code", "divider", ...LIST_KINDS] as const;

function frameRun(random: Random): LayoutFrame[] {
  const roll = int(random, 0, 3);
  if (roll === 0) return [{ kind: "quote" }];
  if (roll === 1) return [{ color: int(random, 0, 8), kind: "callout" }];
  return [];
}

function lineNode(random: Random, id: string, frames: LayoutFrame[]): CanvasNode {
  const kind = pick(random, LINE_KINDS);
  const isList = kind === "bullet" || kind === "ordered" || kind === "checklist";
  return {
    checked: kind === "checklist" && int(random, 0, 1) === 1,
    frames,
    html: kind === "divider" ? "" : text(random, ALPHABET, 24),
    id,
    indent: isList ? int(random, 0, 3) : 0,
    kind,
    level: kind === "heading" ? int(random, 1, 6) : 0,
  };
}

function tableNode(random: Random, ids: () => string, frames: LayoutFrame[]): CanvasNode {
  const rows = int(random, 1, 3);
  const columns = int(random, 1, 3);
  const columnIds = Array.from({ length: columns }, () => `col:${ids().slice(-12)}`);
  return {
    columns: columnIds.map((id) => ({ id, width: int(random, 40, 300) })),
    frames,
    id: ids(),
    kind: "table",
    rows: Array.from({ length: rows }, () => ({
      cells: columnIds.map(() => ({ contentId: ids(), html: text(random, ALPHABET, 10) })),
      id: `w:${ids().slice(-12)}`,
    })),
  };
}

function randomNodes(random: Random, ids: () => string): CanvasNode[] {
  const nodes: CanvasNode[] = [];
  const target = int(random, 0, 12);
  while (nodes.length < target) {
    const frames = frameRun(random);
    const run = int(random, 1, 4);
    for (let i = 0; i < run && nodes.length < target; i++) {
      nodes.push(
        int(random, 0, 9) === 0 ? tableNode(random, ids, frames) : lineNode(random, ids(), frames),
      );
    }
  }
  return nodes;
}

function counter(): () => string {
  let next = 1;
  return () => sectionId(next++);
}

function chain(nodes: CanvasNode[], after: string | null = null): CanvasEdit["upserts"] {
  return nodes.map((node, index) => ({
    after: index === 0 ? after : (nodes[index - 1]?.id ?? null),
    node,
  }));
}

describe("round trip", () => {
  test("writing a document then reading it returns the same nodes", () => {
    forAll(
      (random) => randomNodes(random, counter()),
      (nodes) => {
        const server = new Server();
        server.apply(editOf({ upserts: chain(nodes) }));
        expect(server.nodes()).toEqual(nodes);
      },
    );
  });

  test("empty document reads as no nodes and empty title", () => {
    const server = new Server();
    expect(server.nodes()).toEqual([]);
    expect(server.title()).toBe("");
  });

  test("titles are stored as escaped html with unicode intact", () => {
    forAll(
      (random) => text(random, ALPHABET, 30),
      (title) => {
        const server = new Server();
        server.apply(editOf({ title }));
        expect(server.title()).toBe(escapeCanvasHtml(title));
      },
    );
  });

  test("renaming replaces the title and keeps the nodes", () => {
    const server = new Server();
    const node = lineNode(() => 0.5, sectionId(1), []);
    server.apply(editOf({ title: "one", upserts: [{ after: null, node }] }));
    server.apply(editOf({ title: "two" }));
    expect(server.title()).toBe("two");
    expect(server.nodes()).toEqual([node]);
  });

  test("a second edit changes only what it names", () => {
    forAll(
      (random) => {
        const ids = counter();
        const nodes = randomNodes(random, ids);
        const survivors = nodes.filter(() => int(random, 0, 2) > 0);
        const edited = survivors.map((node) =>
          node.kind !== "table" && node.kind !== "divider" && int(random, 0, 1) === 1
            ? { ...node, html: text(random, ALPHABET, 12) }
            : node,
        );
        const insertAt = int(random, 0, edited.length);
        const added = Array.from({ length: int(random, 0, 3) }, () => lineNode(random, ids(), []));
        return { added, edited, insertAt, nodes };
      },
      ({ added, edited, insertAt, nodes }) => {
        const server = new Server();
        server.apply(editOf({ upserts: chain(nodes) }));
        const expected = [...edited.slice(0, insertAt), ...added, ...edited.slice(insertAt)];
        const original = new Map(nodes.map((node) => [node.id, node]));
        const upserts = expected.flatMap((node, index) =>
          original.get(node.id) === node
            ? []
            : [{ after: index === 0 ? null : (expected[index - 1]?.id ?? null), node }],
        );
        const keptIds = new Set(edited.map((node) => node.id));
        server.apply(
          editOf({
            deleted: nodes.filter((node) => !keptIds.has(node.id)).map((node) => node.id),
            upserts,
          }),
        );
        expect(server.nodes()).toEqual(expected);
      },
    );
  });
});
