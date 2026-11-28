import { expect, test } from "bun:test";
import { parseUserId } from "@slock/slack";
import type { CanvasNode, CanvasTable } from "@slock/types";
import { diffToOps } from "../../../../packages/plugins/src/canvas/client/lib/canvasDiffView";
import type { CanvasNames } from "../../../../packages/plugins/src/canvas/client/lib/canvasEmbeds";
import {
  embedValue,
  isTableValue,
  TABLE_EMBED,
} from "../../../../packages/plugins/src/canvas/client/lib/canvasEmbedValues";
import { type CanvasEmbed, diffNodes } from "../../../../packages/plugins/src/canvas/protocol/api";

const names: CanvasNames = {
  channel: (id) => id,
  controlLabel: () => "embed",
  emojiText: () => null,
  user: () => "Ada",
};

const embeds = new Map<string, CanvasEmbed>([["who", { type: "user", userId: parseUserId("U1") }]]);

const paragraph = (html: string): CanvasNode => ({
  checked: false,
  frames: [],
  html,
  id: "line",
  indent: 0,
  kind: "paragraph",
  level: 0,
});

const table = (...rows: [string, string][]): CanvasTable => ({
  columns: [{ id: "col", width: 100 }],
  frames: [],
  id: "table",
  kind: "table",
  rows: rows.map(([id, html]) => ({ cells: [{ contentId: `cell ${id}`, html }], id })),
});

test("a removed reference still shows who it was", () => {
  const entries = diffNodes([paragraph('hi <control id="who"></control>')], [paragraph("hi ")]);

  const ops = diffToOps(entries, { embeds }, names);

  expect(ops).toContainEqual({
    attributes: { diffmark: "removed" },
    insert: { mention: { id: "U1", kind: "user", name: "Ada" } },
  });
});

test("tables show changed, added and removed cells", () => {
  const entries = diffNodes(
    [table(["a", "old"], ["b", "gone"])],
    [table(["a", "new"], ["c", "fresh"])],
  );

  const value = embedValue(diffToOps(entries, { embeds }, names)[0]?.insert, TABLE_EMBED);

  if (!isTableValue(value)) throw new Error("Expected a table");
  expect(value.rows.map((row) => row.cells[0]?.ops.slice(0, -1))).toEqual([
    [
      { attributes: { diffmark: "removed" }, insert: "old" },
      { attributes: { diffmark: "added" }, insert: "new" },
    ],
    [{ attributes: { diffmark: "removed" }, insert: "gone" }],
    [{ attributes: { diffmark: "added" }, insert: "fresh" }],
  ]);
});
