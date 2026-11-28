import { afterEach, beforeAll, expect, test } from "bun:test";
import { getHost } from "@slock/core/services";
import { service } from "@slock/core/solid";
import type { CanvasAccess } from "@slock/types";
import Quill, { type Op } from "@slock/ui/editor/quill";
import { render } from "@solidjs/web";
import { createContext, useContext } from "solid-js";
import {
  COLUMNS_EMBED,
  TABLE_EMBED,
} from "../../../../packages/plugins/src/canvas/client/lib/canvasEmbedValues";
import CanvasSurface from "../../../../packages/plugins/src/canvas/client/views/CanvasSurface";
import "../../../../packages/plugins/src/canvas/client/views/canvasBlots";
import "../../../../packages/plugins/src/canvas/client/views/canvasBlots/embeds";
import {
  type CanvasServices,
  provideCanvasServices,
} from "../../../../packages/plugins/src/canvas/client/views/canvasBlots/canvasServices";
import { defineCanvasEmbed } from "../../../../packages/plugins/src/canvas/client/views/canvasBlots/defineCanvasEmbed";
import { bootComposerHost, settle } from "../../composer/client/composerHarness";

beforeAll(bootComposerHost);

let dispose = () => {};
async function unmount() {
  dispose();
  dispose = () => {};
  await settle();
}

afterEach(async () => {
  await unmount();
  document.body.replaceChildren();
});

async function mount(embed: string, value: unknown, access: CanvasAccess = "edit") {
  let saves = 0;
  let surfaces = 0;
  const services: CanvasServices = {
    activate: () => {},
    afterChange: () => {
      saves += 1;
    },
    movesAnnotation: () => false,
    names: {
      channel: (id) => id,
      controlLabel: () => "",
      emojiText: () => null,
      user: (id) => id,
    },
    newId: () => "id",
    access,
    register: () => {
      surfaces += 1;
      return () => {
        surfaces -= 1;
      };
    },
    upload: () => {},
  };
  const host = document.createElement("div");
  host.className = "canvas-editor";
  provideCanvasServices(host, services);
  document.body.append(host);
  dispose = render(
    () => (
      <CanvasSurface
        ariaLabel="test"
        formats={[embed]}
        initialOps={[{ insert: { [embed]: value } }, { insert: "\n" }]}
        scope={() => ""}
        services={services}
      />
    ),
    host,
  );
  await settle();
  await settle();
  return { host, saves: () => saves, surfaces: () => surfaces };
}

const mountColumns = (access?: CanvasAccess) =>
  mount(
    COLUMNS_EMBED,
    {
      columns: [[{ insert: "left\n" }], [{ insert: "right\n" }]],
      id: "columns",
      weights: [3, 3],
    },
    access,
  );

function quillOf(container: Element | null | undefined): Quill {
  const found = container ? Quill.find(container) : null;
  if (!(found instanceof Quill)) throw new Error("Expected an editor");
  return found;
}

test("a removed table row comes back with undo, also from inside a cell", async () => {
  const row = (name: string, ops: Op[]) => ({ cells: [{ contentId: name, ops }], id: name });
  const { host } = await mount(TABLE_EMBED, {
    columns: [{ id: "col", width: 100 }],
    id: "table",
    rows: [row("a", [{ insert: "keep\n" }]), row("b", [{ insert: "gone\n" }])],
  });
  const cells = () => [...host.querySelectorAll("td .ql-editor")].map((cell) => cell.textContent);
  const remove = host.querySelectorAll<HTMLElement>("[aria-label='Remove row']");

  remove[1]?.click();
  await settle();
  await settle();
  expect(cells()).toEqual(["keep"]);

  const left = quillOf(host.querySelector("td .ql-container"));
  expect(left.root.matches(":focus")).toBe(true);
  left.root.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "z" }));
  await settle();
  await settle();
  expect(cells()).toEqual(["keep", "gone"]);

  quillOf(host.querySelector(".ql-container")).history.redo();
  await settle();
  await settle();
  expect(cells()).toEqual(["keep"]);
});

test("a surface mounts the embeds its document already has", async () => {
  const { host } = await mountColumns();
  const columns = [...host.querySelectorAll(".canvas-column .ql-editor")];
  expect(columns.map((column) => column.textContent)).toEqual(["left", "right"]);
});

test("unmounting a surface also unmounts the editors inside its embeds", async () => {
  const { surfaces } = await mountColumns();
  expect(surfaces()).toBe(3);

  await unmount();

  expect(surfaces()).toBe(0);
});

test("arrow keys resize columns without reaching the editor", async () => {
  const { host, saves } = await mountColumns();
  let leaked = 0;
  host.querySelector(".ql-editor")?.addEventListener("keydown", () => {
    leaked += 1;
  });
  const handle = host.querySelector(".canvas-column-handle");
  handle?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
  await settle();
  expect(handle?.getAttribute("aria-valuenow")).toBe("4");
  expect(saves()).toBeGreaterThan(0);
  expect(leaked).toBe(0);
});

test("a caret placed inside a column stays where it landed", async () => {
  const { host } = await mountColumns();
  const text = host.querySelector(".canvas-columns .ql-editor p")?.firstChild;
  if (!text) throw new Error("Expected column text");

  window.getSelection()?.setBaseAndExtent(text, 2, text, 2);
  document.dispatchEvent(new Event("selectionchange"));

  expect(window.getSelection()?.anchorNode).toBe(text);
  expect(window.getSelection()?.anchorOffset).toBe(2);
});

test("a formatting shortcut in a column changes that column", async () => {
  const { host } = await mountColumns();
  const column = quillOf(host.querySelector(".canvas-column .ql-container"));
  column.focus();
  column.setSelection(0, 4);

  column.root.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "b" }),
  );
  await settle();

  expect(column.getContents().ops[0]).toEqual({ attributes: { bold: true }, insert: "left" });
});

test.each([
  "view",
  "comment",
] as const)("%s access keeps a caret but refuses edits", async (access) => {
  const { host, saves } = await mountColumns(access);
  const column = quillOf(host.querySelector(".canvas-column .ql-container"));

  column.insertText(0, "x", "user");

  expect(column.root.isContentEditable).toBe(true);
  expect(column.isEnabled()).toBe(false);
  expect(column.getText()).toBe("left\n");
  expect(saves()).toBe(0);
});

test("a global shortcut still fires from inside a column, once", async () => {
  const { host } = await mountColumns();
  let fired = 0;
  const unregister = service("ui").shortcuts.register({
    allowInInputs: true,
    combo: { alt: true, key: "m", mod: true },
    group: "Canvas",
    handler: () => {
      fired += 1;
    },
    id: "test.nested",
    label: "Test",
    scope: "general",
  });

  host
    .querySelector(".canvas-columns .ql-editor")
    ?.dispatchEvent(
      new KeyboardEvent("keydown", { altKey: true, bubbles: true, ctrlKey: true, key: "m" }),
    );
  unregister();

  expect(fired).toBe(1);
});

test("embeds see what the app provides to the rest of the page", async () => {
  const Provided = createContext("missing");
  defineCanvasEmbed<string>({
    className: "canvas-probe-embed",
    name: "canvasProbe",
    view: () => <>{useContext(Provided)}</>,
  });
  await getHost().register({
    id: "canvasProbe",
    setup: (ctx) =>
      ctx.add("shell.provider", (props) => <Provided value="provided">{props.children}</Provided>),
  });

  const { host } = await mount("canvasProbe", "probe");

  expect(host.querySelector(".canvas-probe-embed")?.textContent).toContain("provided");
});
