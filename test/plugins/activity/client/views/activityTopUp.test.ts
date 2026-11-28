import { describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import type { Services } from "@slock/core/types";
import { createMemo, createRoot, createSignal, flush } from "solid-js";
import { MAX_AUTO_TOP_UP_ATTEMPTS } from "../../../../../packages/plugins/src/activity/client/views/activityScroll";
import { createActivityTopUp } from "../../../../../packages/plugins/src/activity/client/views/activityTopUp";
import { createFakeEnv, partialService } from "../../../../support/core";

async function mountTopUp() {
  const { feed, more } = createRoot(() => ({
    feed: createMemo(() => true),
    more: createMemo(() => undefined),
  }));
  const loads: unknown[][] = [];
  const host = createHost({ env: createFakeEnv(), reactive: solidReactive });
  setHost(host);
  await host.register({
    id: "activity",
    setup: (ctx) =>
      ctx.provide(
        "activity",
        partialService<Services["activity"]>({
          activityFeed: feed,
          activityMore: more,
          loadMoreActivity: (...args) => {
            loads.push(args);
          },
        }),
      ),
  });
  const [rows, setRows] = createSignal(0);
  const [key, setKey] = createSignal("a");
  const container = document.createElement("div");
  const dispose = createRoot((dispose) => {
    createActivityTopUp({
      container: () => container,
      key,
      rows,
      types: () => "mentions",
      unreadOnly: () => true,
    });
    return dispose;
  });
  flush();
  return {
    dispose,
    loads,
    setKey,
    tick: () => {
      setRows((n) => n + 1);
      flush();
    },
  };
}

describe("createActivityTopUp", () => {
  test("tops up an unfilled viewport with the active filter until the attempt cap", async () => {
    const view = await mountTopUp();
    for (let i = 0; i < MAX_AUTO_TOP_UP_ATTEMPTS * 2; i++) view.tick();
    expect(view.loads).toHaveLength(MAX_AUTO_TOP_UP_ATTEMPTS);
    expect(view.loads[0]).toEqual(["mentions", true]);
    view.dispose();
  });

  test("changing the filter key grants a fresh set of attempts", async () => {
    const view = await mountTopUp();
    for (let i = 0; i < MAX_AUTO_TOP_UP_ATTEMPTS * 2; i++) view.tick();
    view.setKey("b");
    flush();
    expect(view.loads).toHaveLength(MAX_AUTO_TOP_UP_ATTEMPTS + 1);
    view.dispose();
  });
});
