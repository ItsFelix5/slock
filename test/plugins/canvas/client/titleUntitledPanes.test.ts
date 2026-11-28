import { expect, test } from "bun:test";
import type { Services } from "@slock/core/types";
import { createRoot, createSignal, flush } from "solid-js";
import { titleUntitledPanes } from "../../../../packages/plugins/src/canvas/client/lib/titleUntitledPanes";
import { partialService } from "../../../support/core";
import { fid } from "../../../support/slack";

type Pane = ReturnType<Services["shell.panes"]["panes"]>[number];

const pane = (id: string, fileId: string, title = ""): Pane =>
  partialService<Pane>({ content: { fileId: fid(fileId), kind: "canvas", title }, id });

test("only untitled canvas panes are titled, once the title is known", () => {
  const set: [string, unknown][] = [];
  const [titles, setTitles] = createSignal<Record<string, string>>({});
  const dispose = createRoot((disposeRoot) => {
    titleUntitledPanes(
      {
        panes: () => [pane("a", "F1"), pane("b", "F2", "Notes")],
        setPaneContent: (id, content) => {
          set.push([id, content]);
        },
      },
      (fileId) => titles()[fileId],
    );
    return disposeRoot;
  });
  flush();
  expect(set).toEqual([]);

  setTitles({ [fid("F1")]: "Plan", [fid("F2")]: "Other" });
  flush();
  expect(set).toEqual([["a", { fileId: fid("F1"), kind: "canvas", title: "Plan" }]]);
  dispose();
});
