import { afterEach, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { type Pane, provideUi } from "@slock/ui";
import { render } from "@solidjs/web";
import { createSignal, flush } from "solid-js";
import ScrollingLayout from "../../../../packages/plugins/src/layout-scrolling/client/views/ScrollingLayout";
import { createFakeEnv } from "../../../support/core";

let teardown: (() => void) | undefined;

afterEach(() => teardown?.());

test("switching the active pane reveals it without reading a signal in the effect", async () => {
  const host = createHost({ env: createFakeEnv(), reactive: solidReactive });
  setHost(host);
  await host.register({ id: "ui", setup: provideUi });
  const panes: Pane<string>[] = [
    { content: "A", id: "a", size: 0.5 },
    { content: "B", id: "b", size: 0.5 },
  ];
  const [activePaneId, setActivePaneId] = createSignal<string | null>("a");
  const root = document.createElement("div");
  document.body.append(root);
  const dispose = render(
    () => (
      <ScrollingLayout
        activePaneId={activePaneId}
        containerWidth={() => 800}
        onActivate={() => {}}
        onResize={() => {}}
        panes={panes}
        renderPane={(pane) => pane.content}
      />
    ),
    root,
  );
  teardown = () => {
    dispose();
    root.remove();
    host.stop();
  };
  flush();
  setActivePaneId("b");
  flush();
  expect(root.querySelectorAll("[data-cell]").length).toBe(2);
});
