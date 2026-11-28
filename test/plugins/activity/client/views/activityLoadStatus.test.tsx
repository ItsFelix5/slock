import { describe, expect, spyOn, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import type { Services } from "@slock/core/types";
import { render } from "@solidjs/web";
import { For, flush } from "solid-js";
import { ActivityFeedStatus } from "../../../../../packages/plugins/src/activity/client/views/activityLoadStatus";
import { createFakeEnv, partialService } from "../../../../support/core";
import { entry, harness } from "../store/feedLoadHarness";

const settle = async () => {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
    flush();
  }
};

async function mountStatus(h: ReturnType<typeof harness>) {
  const host = createHost({ env: createFakeEnv(), reactive: solidReactive });
  setHost(host);
  await host.register({
    id: "activity",
    setup: (ctx) =>
      ctx.provide(
        "activity",
        partialService<Services["activity"]>({
          activityFeed: h.load.activityFeed,
          retryActivityLoad: h.load.retryActivityLoad,
        }),
      ),
  });
  const root = document.createElement("div");
  document.body.append(root);
  const dispose = render(
    () => (
      <>
        <ActivityFeedStatus empty={h.items.length === 0} />
        <ul>
          <For each={h.items}>{(item) => <li>{item.id}</li>}</For>
        </ul>
      </>
    ),
    root,
  );
  return {
    [Symbol.dispose]: () => {
      dispose();
      root.remove();
    },
    rows: () => [...root.querySelectorAll("li")].map((li) => li.textContent),
    html: () => root.innerHTML,
    tryAgain: () => root.querySelector("button"),
  };
}

describe("ActivityFeedStatus", () => {
  test("shows the loading state until the first page arrives", async () => {
    using h = harness({ ":": { entries: [entry("a", 100)] } }, { held: true });
    using view = await mountStatus(h);
    await settle();
    expect(view.html()).toContain("Loading activity");
    expect(view.rows()).toEqual([]);
    h.release();
    await settle();
    expect(view.html()).not.toContain("Loading activity");
    expect(view.rows()).toEqual(["a"]);
  });

  test("a failed first load shows the error and retry shows the rows", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    try {
      using h = harness({ ":": { entries: [entry("a", 100)] } }, { ready: false });
      h.failOnce(undefined, "");
      using view = await mountStatus(h);
      h.setReady(true);
      await settle();
      expect(view.html()).toContain("Couldn't load activity.");
      expect(view.rows()).toEqual([]);
      view.tryAgain()?.click();
      await settle();
      expect(view.html()).not.toContain("Couldn't load activity.");
      expect(view.rows()).toEqual(["a"]);
    } finally {
      consoleError.mockRestore();
    }
  });
});
