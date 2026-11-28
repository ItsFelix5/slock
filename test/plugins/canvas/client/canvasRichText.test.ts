import { afterEach, beforeAll, expect, test } from "bun:test";
import { parseChannelId, parseFileId, parseTs, parseUserId } from "@slock/slack";
import type { CanvasLine, CanvasNode } from "@slock/types";
import Quill from "@slock/ui/editor/quill";
import { canvasToOps } from "../../../../packages/plugins/src/canvas/client/lib/canvasDelta";
import {
  type CanvasNames,
  embedKey,
} from "../../../../packages/plugins/src/canvas/client/lib/canvasEmbeds";
import {
  embedValue,
  isTableValue,
  TABLE_EMBED,
} from "../../../../packages/plugins/src/canvas/client/lib/canvasEmbedValues";
import { opsToLines } from "../../../../packages/plugins/src/canvas/client/lib/canvasLines";
import {
  pasteCanvasContent,
  pasteImageLinks,
  pasteTables,
} from "../../../../packages/plugins/src/canvas/client/lib/canvasPaste";
import { buildPool } from "../../../../packages/plugins/src/canvas/client/lib/canvasPool";
import "../../../../packages/plugins/src/canvas/client/views/canvasBlots";
import "../../../../packages/plugins/src/canvas/client/views/canvasBlots/embeds";
import {
  CANVAS_FORMATS,
  CELL_FORMATS,
} from "../../../../packages/plugins/src/canvas/client/views/canvasBlots/formats";
import type { CanvasEmbed } from "../../../../packages/plugins/src/canvas/protocol/api";
import { bootComposerHost } from "../../composer/client/composerHarness";
import { meta, sectionId } from "../protocol/canvasSimulator";

const names: CanvasNames = {
  channel: (id) => id,
  controlLabel: () => "embed",
  emojiText: (name) => (name === "smile" ? "😄" : null),
  user: () => "Ada",
};

const embeds = new Map<string, CanvasEmbed>([
  ["who", { type: "user", userId: parseUserId("U1") }],
  ["grin", { shortcode: "smile", type: "emoji" }],
]);

beforeAll(bootComposerHost);
afterEach(() => document.body.replaceChildren());

function throughEditor(html: string, kind: CanvasLine["kind"] = "paragraph") {
  const node: CanvasLine = {
    checked: false,
    frames: [],
    html,
    id: sectionId(1),
    indent: 0,
    kind,
    level: 0,
  };
  const element = document.createElement("div");
  document.body.append(element);
  const quill = new Quill(element, { formats: CANVAS_FORMATS });
  quill.setContents(canvasToOps({ embeds, fileIds: [], meta, nodes: [node], title: "" }, names));
  const keys = new Map([...embeds].map(([id, embed]) => [id, embedKey(embed, id)]));
  const { entries } = opsToLines(quill.getContents().ops, {
    annotations: new Set(),
    baselineHtml: () => undefined,
    controls: [],
    names,
    newId: () => "temp:new",
    pool: buildPool([node], keys),
    retired: new Set(),
  });
  const [line] = entries;
  return line && "html" in line.node ? line.node.html : undefined;
}

const who = '<control id="who"></control>';
const grin = '<control id="grin"></control>';

test.each([
  ["a comment over several formats", '<annotation id="c1"><b>bold</b> plain</annotation>'],
  ["a link over several formats", '<a href="https://x.test/?a=1&amp;b=2"><b>bold</b> link</a>'],
  [
    "a comment inside part of a link",
    '<a href="https://x.test"><annotation id="c1">in</annotation> out</a>',
  ],
  ["nested comments", '<annotation id="c1">one <annotation id="c2">two</annotation></annotation>'],
  ["a formatted, commented reference", `<annotation id="c1"><b>hi ${who}</b></annotation>`],
  ["a standard emoji reference", `a ${grin} b`],
  ["a tag this client does not know", '<sup data-x="1">up <b>bold</b></sup> down'],
])("%s survives the editor", (_, html) => {
  expect(throughEditor(html)).toBe(html);
});

test("code lines keep comments and references", () => {
  const html = `<annotation id="c1">let&nbsp;a</annotation><br>${who}&nbsp;=&nbsp;1`;

  expect(throughEditor(html, "code")).toBe(html);
});

test("a pasted table stays a table with its formatting", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const quill = new Quill(element, { formats: CANVAS_FORMATS });
  let id = 0;
  pasteTables(quill, () => `temp:${++id}`);

  const { ops } = quill.clipboard.convert({
    html: "<table><tr><th>Name</th><th><p><b>Owner</b></p></th></tr><tr><td>a</td></tr></table>",
  });

  const table = embedValue(ops[0]?.insert, TABLE_EMBED);
  if (!isTableValue(table)) throw new Error("Expected a table");
  expect(table.columns).toHaveLength(2);
  expect(table.rows.map((row) => row.cells.map((cell) => cell.ops))).toEqual([
    [
      [{ insert: "Name" }, { insert: "\n" }],
      [{ attributes: { bold: true }, insert: "Owner" }, { insert: "\n" }],
    ],
    [[{ insert: "a" }, { insert: "\n" }], [{ insert: "\n" }]],
  ]);
});

test("pasted images stay reachable instead of vanishing", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const quill = new Quill(element, { formats: CANVAS_FORMATS });
  pasteImageLinks(quill);

  const { ops } = quill.clipboard.convert({
    html: '<p>a <img src="https://x.test/cat.png" alt="cat"> <img src="data:image/png;base64,AA" alt=":tada:"></p>',
  });

  expect(ops).toEqual([
    { insert: "a " },
    { attributes: { link: "https://x.test/cat.png" }, insert: "cat" },
    { insert: " :tada:" },
  ]);
});

test("every kind of block can be shown", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const quill = new Quill(element, { formats: CANVAS_FORMATS });
  const fileId = parseFileId("F1");
  const line = { checked: false, frames: [], html: "", indent: 0, level: 0 };
  const nodes: CanvasNode[] = [
    { ...line, id: sectionId(1), kind: "divider" },
    { fileId, frames: [], id: sectionId(2), kind: "file", permalink: "" },
    {
      fileId,
      frames: [],
      height: 1,
      id: sectionId(3),
      kind: "image",
      mimetype: "image/png",
      name: "cat.png",
      thumbs: [],
      weight: 1,
      width: 1,
    },
    { columns: [], frames: [], id: sectionId(4), kind: "table", rows: [] },
    { frames: [], id: sectionId(5), kind: "unknown", text: "?" },
    {
      channelId: parseChannelId("C1"),
      frames: [],
      id: sectionId(6),
      isMessage: false,
      kind: "card",
      ownerId: "E1",
      ts: parseTs("1.000001"),
      url: "https://example.com",
    },
  ];

  quill.setContents(canvasToOps({ embeds, fileIds: [], meta, nodes, title: "" }, names));

  expect(quill.getContents().ops.filter((op) => typeof op.insert !== "string")).toHaveLength(6);
});

test("pasted web content brings no comments, diff colours or unknown tags", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const quill = new Quill(element, { formats: CANVAS_FORMATS });
  pasteCanvasContent(quill, (id) => id === "cut");

  const { ops } = quill.clipboard.convert({
    html: '<p data-diff="removed"><span class="canvas-diff-added">a</span><span class="canvas-annotation" data-annotation="copied">b</span><span class="canvas-annotation" data-annotation="cut">c</span><span data-html-tags="&lt;span style=&quot;color:red&quot;&gt;">d</span></p>',
  });

  expect(ops.flatMap((op) => Object.entries(op.attributes ?? {}))).toEqual([["annotation", "cut"]]);
});

test("line breaks in a table cell are shown and saved", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const quill = new Quill(element, { formats: CELL_FORMATS });
  quill.setContents([{ insert: "a" }, { insert: { softbreak: true } }, { insert: "b\nc\n" }]);
  const table = {
    columns: [{ id: "col", width: 1 }],
    id: "table",
    rows: [{ cells: [{ contentId: "cell", ops: quill.getContents().ops }], id: "row" }],
  };

  const { entries } = opsToLines(
    [{ attributes: { sid: "table" }, insert: { [TABLE_EMBED]: table } }],
    {
      annotations: new Set(),
      baselineHtml: () => undefined,
      controls: [],
      names,
      newId: () => "temp:new",
      pool: buildPool([], new Map()),
      retired: new Set(),
    },
  );

  expect(entries[0]?.node).toMatchObject({ rows: [{ cells: [{ html: "a<br>b<br>c" }] }] });
});

test("raw newlines never split a line", () => {
  expect(throughEditor("one\ntwo")).toBe("one<br>two");
});
