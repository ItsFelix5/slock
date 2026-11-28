import { describe, expect, test } from "bun:test";
import type { CanvasLine, CanvasNode, CanvasTable } from "@slock/types";
import { validate } from "../../../../packages/plugins/src/canvas/protocol/validate.ts";
import { editOf, sectionId } from "./canvasSimulator.ts";

const line: CanvasLine = {
  checked: false,
  frames: [],
  html: "x",
  id: sectionId(1),
  indent: 0,
  kind: "paragraph",
  level: 0,
};

const table: CanvasTable = {
  columns: [{ id: "col:a", width: 100 }],
  frames: [],
  id: sectionId(2),
  kind: "table",
  rows: [{ cells: [{ contentId: sectionId(3), html: "" }], id: "row:a" }],
};

const known = new Map<string, unknown>();

function upsert(node: CanvasNode) {
  return editOf({ upserts: [{ after: null, node }] });
}

describe("validate", () => {
  test("accepts well formed lines and tables", () => {
    expect(validate(upsert(line), known)).toBeNull();
    expect(validate(upsert(table), known)).toBeNull();
  });

  test("accepts native ids of records that already exist", () => {
    const native = "fBM9CA3QwOH";
    expect(validate(upsert({ ...line, id: native }), new Map([[native, {}]]))).toBeNull();
    expect(validate(upsert({ ...line, id: native }), known)).toBe("invalid_id");
  });

  test.each([
    ["bad node id", upsert({ ...line, id: "nope" }), "invalid_id"],
    ["bad control id", editOf({ controls: [{ id: "x", kind: "annotation" }] }), "invalid_id"],
    ["huge html", upsert({ ...line, html: "a".repeat(200_001) }), "line_too_long"],
    ["negative indent", upsert({ ...line, indent: -1 }), "invalid_indent"],
    ["deep indent", upsert({ ...line, indent: 9 }), "invalid_indent"],
    ["bad level", upsert({ ...line, level: 7 }), "invalid_level"],
    [
      "callout color",
      upsert({ ...line, frames: [{ color: 9, kind: "callout" }] }),
      "invalid_layout",
    ],
    [
      "column index",
      upsert({
        ...line,
        frames: [{ id: sectionId(5), index: 2, kind: "columns", weights: [3, 3] }],
      }),
      "invalid_layout",
    ],
    [
      "column weight",
      upsert({ ...line, frames: [{ id: sectionId(5), index: 0, kind: "columns", weights: [7] }] }),
      "invalid_layout",
    ],
    ["empty table", upsert({ ...table, rows: [] }), "invalid_table"],
    ["ragged table", upsert({ ...table, rows: [{ cells: [], id: "row:a" }] }), "invalid_table"],
    [
      "duplicate cell ids",
      upsert({
        ...table,
        rows: [
          { cells: [{ contentId: sectionId(3), html: "" }], id: "row:a" },
          { cells: [{ contentId: sectionId(3), html: "" }], id: "row:b" },
        ],
      }),
      "invalid_table",
    ],
    [
      "row id prefix",
      upsert({ ...table, rows: [{ ...(table.rows[0] ?? { cells: [] }), id: "x" }] }),
      "invalid_table",
    ],
    ["column id prefix", upsert({ ...table, columns: [{ id: "x", width: 1 }] }), "invalid_table"],
  ])("rejects %s", (_name, edit, error) => {
    expect(validate(edit, known)).toBe(error);
  });

  test("rejects too many edits", () => {
    expect(
      validate(editOf({ deleted: Array.from({ length: 5001 }, () => sectionId(1)) }), known),
    ).toBe("edit_too_large");
  });
});
