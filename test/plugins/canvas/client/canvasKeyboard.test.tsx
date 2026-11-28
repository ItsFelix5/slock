import { afterEach, beforeAll, expect, test } from "bun:test";
import type Quill from "@slock/ui/editor/quill";
import type { Op } from "@slock/ui/editor/quill";
import { render } from "@solidjs/web";
import {
  canvasCommandItems,
  runCanvasCommand,
} from "../../../../packages/plugins/src/canvas/client/lib/canvasCommands";
import { TABLE_EMBED } from "../../../../packages/plugins/src/canvas/client/lib/canvasEmbedValues";
import CanvasSurface from "../../../../packages/plugins/src/canvas/client/views/CanvasSurface";
import "../../../../packages/plugins/src/canvas/client/views/canvasBlots";
import "../../../../packages/plugins/src/canvas/client/views/canvasBlots/embeds";
import {
  type CanvasServices,
  provideCanvasServices,
} from "../../../../packages/plugins/src/canvas/client/views/canvasBlots/canvasServices";
import { CANVAS_FORMATS } from "../../../../packages/plugins/src/canvas/client/views/canvasBlots/formats";
import { bootComposerHost, settle } from "../../composer/client/composerHarness";

beforeAll(bootComposerHost);

let dispose = () => {};
afterEach(() => {
  dispose();
  document.body.replaceChildren();
});

async function mountTable() {
  const quills: Quill[] = [];
  let id = 0;
  const services: CanvasServices = {
    access: "edit",
    activate: () => {},
    afterChange: () => {},
    movesAnnotation: () => false,
    names: {
      channel: (channel) => channel,
      controlLabel: () => "",
      emojiText: () => null,
      user: (user) => user,
    },
    newId: () => `temp:${++id}`,
    register: (_scope, quill) => {
      quills.push(quill);
      return () => {};
    },
    upload: () => {},
  };
  const cell = (text: string) => ({ contentId: text, ops: [{ insert: `${text}\n` }] });
  const table = {
    columns: [{ id: "col", width: 100 }],
    id: "table",
    rows: [
      { cells: [cell("top")], id: "row:a" },
      { cells: [cell("bottom")], id: "row:b" },
    ],
  };
  const initialOps: Op[] = [
    { insert: "before\n" },
    { insert: { [TABLE_EMBED]: table } },
    { insert: "after\n" },
  ];
  const host = document.createElement("div");
  host.className = "canvas-editor";
  provideCanvasServices(host, services);
  document.body.append(host);
  dispose = render(
    () => (
      <CanvasSurface
        ariaLabel="test"
        formats={CANVAS_FORMATS}
        initialOps={initialOps}
        scope={() => ""}
        services={services}
      />
    ),
    host,
  );
  await settle();
  await settle();
  const editor = (text: string) => {
    const found = quills.find((quill) => quill.getText() === text);
    if (!found) throw new Error(`No editor holds ${text}`);
    return found;
  };
  const root = () => {
    const [first] = quills;
    if (!first) throw new Error("No editor mounted");
    return first;
  };
  const focused = () => quills.find((quill) => quill.root.matches(":focus"))?.getText();
  return { editor, focused, host, root };
}

function press(quill: Quill, key: "ArrowDown" | "ArrowUp") {
  quill.root.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }));
}

test("arrows walk into a table, through its rows and out again", async () => {
  const { editor, focused, root } = await mountTable();
  root().focus();
  root().setSelection(0, 0);

  press(root(), "ArrowDown");
  expect(focused()).toBe("top\n");
  press(editor("top\n"), "ArrowDown");
  expect(focused()).toBe("bottom\n");
  press(editor("bottom\n"), "ArrowDown");
  expect(focused()).toBe(root().getText());
  expect(root().getSelection()?.index).toBe(8);
  press(root(), "ArrowUp");
  expect(focused()).toBe("bottom\n");
});

test("a cell's menu changes its table and offers no line formats", async () => {
  const { editor, host } = await mountTable();
  const cell = editor("top\n");
  cell.focus();

  const names = canvasCommandItems(cell).map((item) => item.name);
  expect(names).toContain("Remove row");
  expect(names).not.toContain("Heading 1");
  expect(names).not.toContain("Bulleted list");

  runCanvasCommand("Add row", cell, {
    comment: () => {},
    newId: () => "",
    pickDate: () => {},
    pickFiles: () => {},
    react: () => {},
  });
  await settle();
  expect(host.querySelectorAll("tr")).toHaveLength(3);
});
