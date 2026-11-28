import { describe, expect, test } from "bun:test";
import { parseFileId } from "@slock/slack";
import type { CanvasEdit, CanvasNode, LayoutFrame } from "@slock/types";
import { planEdit } from "../../../../packages/plugins/src/canvas/protocol/plan.ts";
import { controlContext, editOf, meta, Server, sectionId } from "./canvasSimulator.ts";

function line(
  n: number,
  kind: "bullet" | "checklist" | "code" | "divider" | "heading" | "ordered" | "paragraph",
  extra: Partial<Extract<CanvasNode, { kind: typeof kind }>> = {},
): CanvasNode {
  return {
    checked: false,
    frames: [],
    html: kind === "divider" ? "" : `line ${n}`,
    id: sectionId(n),
    indent: 0,
    kind,
    level: 0,
    ...extra,
  };
}

function chain(nodes: CanvasNode[]): CanvasEdit["upserts"] {
  return nodes.map((node, index) => ({ after: nodes[index - 1]?.id ?? null, node }));
}

function written(nodes: CanvasNode[]): Server {
  const server = new Server();
  server.apply(editOf({ upserts: chain(nodes) }));
  return server;
}

function columns(n: number, index: number, weights = [3, 3]): LayoutFrame {
  return { id: sectionId(n), index, kind: "columns", weights };
}

describe("block types", () => {
  test("headings keep their level", () => {
    const nodes = [1, 2, 3, 4, 5, 6].map((level) => line(level, "heading", { level }));
    expect(written(nodes).nodes()).toEqual(nodes);
  });

  test("code, divider and paragraph interleave", () => {
    const nodes = [line(1, "code"), line(2, "divider"), line(3, "paragraph"), line(4, "divider")];
    expect(written(nodes).nodes()).toEqual(nodes);
  });

  test("nested lists keep indent and kind changes split lists", () => {
    const nodes = [
      line(1, "bullet"),
      line(2, "bullet", { indent: 1 }),
      line(3, "bullet", { indent: 2 }),
      line(4, "ordered"),
      line(5, "ordered", { indent: 1 }),
      line(6, "checklist", { checked: true }),
      line(7, "checklist", { indent: 1 }),
    ];
    expect(written(nodes).nodes()).toEqual(nodes);
  });

  test("table with unicode cells and column widths", () => {
    const table: CanvasNode = {
      columns: [
        { id: "col:aaaa", width: 120 },
        { id: "col:bbbb", width: 400 },
      ],
      frames: [],
      id: sectionId(1),
      kind: "table",
      rows: [
        {
          cells: [
            { contentId: sectionId(2), html: "\u{1F600} &amp; א" },
            { contentId: sectionId(3), html: "" },
          ],
          id: "row:rrrr1",
        },
        {
          cells: [
            { contentId: sectionId(4), html: "x" },
            { contentId: sectionId(5), html: "y" },
          ],
          id: "row:rrrr2",
        },
      ],
    };
    expect(written([line(0, "paragraph"), table, line(9, "paragraph")]).nodes()).toEqual([
      line(0, "paragraph"),
      table,
      line(9, "paragraph"),
    ]);
  });

  test("image and file keep their metadata", () => {
    const image: CanvasNode = {
      fileId: parseFileId("F1"),
      frames: [],
      height: 40,
      id: sectionId(1),
      kind: "image",
      mimetype: "image/png",
      name: "a.png",
      thumbs: [{ height: 20, name: "thumb_360", width: 30 }],
      weight: 6,
      width: 60,
    };
    const file: CanvasNode = {
      fileId: parseFileId("F2"),
      frames: [],
      id: sectionId(2),
      kind: "file",
      permalink: "https://x.slack.com/files/F2",
    };
    expect(written([image, file]).nodes()).toEqual([image, file]);
  });

  test("columns and callouts nest", () => {
    const nodes = [
      line(1, "paragraph", { frames: [columns(100, 0)] }),
      line(2, "bullet", { frames: [columns(100, 0)] }),
      line(3, "paragraph", { frames: [columns(100, 1), { color: 2, kind: "callout" }] }),
      line(4, "paragraph", { frames: [columns(100, 1), { color: 2, kind: "callout" }] }),
      line(5, "paragraph", { frames: [{ kind: "quote" }] }),
    ];
    expect(written(nodes).nodes()).toEqual(nodes);
  });
});

describe("edits", () => {
  test("deleting every list item removes the list", () => {
    const server = written([line(1, "bullet"), line(2, "bullet")]);
    server.apply(editOf({ deleted: [sectionId(1), sectionId(2)] }));
    expect(server.nodes()).toEqual([]);
    expect(server.sections.size).toBe(0);
  });

  test("toggling a checklist item changes only that item", () => {
    const nodes = [line(1, "checklist"), line(2, "checklist")];
    const server = written(nodes);
    const toggled = line(2, "checklist", { checked: true });
    server.apply(editOf({ upserts: [{ after: sectionId(1), node: toggled }] }));
    expect(server.nodes().map((node) => node.id)).toEqual(nodes.map((node) => node.id));
    expect(server.nodes()).toContainEqual(toggled);
    expect(server.nodes()).toContainEqual(line(1, "checklist"));
  });

  test("moving a node to the front reorders", () => {
    const nodes = [line(1, "paragraph"), line(2, "paragraph"), line(3, "paragraph")];
    const server = written(nodes);
    server.apply(editOf({ upserts: [{ after: null, node: line(3, "paragraph") }] }));
    expect(server.nodes().map((node) => node.id)).toEqual([
      sectionId(3),
      sectionId(1),
      sectionId(2),
    ]);
  });

  test("changing a bullet into a heading leaves the list", () => {
    const server = written([line(1, "bullet"), line(2, "bullet"), line(3, "bullet")]);
    const heading = line(2, "heading", { level: 2 });
    server.apply(editOf({ upserts: [{ after: sectionId(1), node: heading }] }));
    expect(server.nodes().map((node) => node.kind)).toEqual(["bullet", "heading", "bullet"]);
  });

  test("two edits planned from the same base both land without duplicates", () => {
    const server = written([line(1, "paragraph"), line(2, "paragraph")]);
    const base = server.decoded();
    server.apply(editOf({ upserts: [{ after: sectionId(1), node: line(10, "paragraph") }] }), base);
    server.apply(editOf({ upserts: [{ after: sectionId(2), node: line(11, "paragraph") }] }), base);
    const ids = server.nodes().map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(sectionId(10));
    expect(ids).toContain(sectionId(11));
  });

  test("deleting something already deleted is a no-op", () => {
    const server = written([line(1, "paragraph")]);
    const base = server.decoded();
    server.apply(editOf({ deleted: [sectionId(1)] }));
    expect(() => server.apply(editOf({ deleted: [sectionId(1)] }), base)).not.toThrow();
  });

  test("inserting after a removed anchor is rejected", () => {
    const server = written([line(1, "paragraph")]);
    const result = planEdit(
      server.decoded(),
      editOf({ upserts: [{ after: sectionId(7), node: line(2, "paragraph") }] }),
      controlContext,
    );
    expect(result).toEqual({ error: "unknown_anchor", ok: false });
  });

  test("a document without metadata cannot be edited", () => {
    expect(planEdit({ meta: null, records: [] }, editOf({}), controlContext)).toEqual({
      error: "no_document",
      ok: false,
    });
    expect(planEdit({ meta, records: [] }, editOf({}), controlContext).ok).toBe(true);
  });
});
