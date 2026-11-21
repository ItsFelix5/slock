import { expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv, partialService } from "@slock/core/testing";
import type { Services } from "@slock/core/types";
import { ch } from "@slock/slack/testing";
import type { Channel, ChannelId } from "@slock/types";
import { provideUi } from "@slock/ui";
import { createRoot, createSignal, flush } from "solid-js";
import querySetup from "../../../src/query/client/index";

const A = ch("C1");
const B = ch("C2");

async function start() {
  const host = createHost({ env: createFakeEnv(1, 1_000_000), reactive: solidReactive });
  setHost(host);
  await host.register(
    { id: "ui", setup: provideUi },
    { id: "query", setup: querySetup },
    {
      id: "feedback",
      setup: (ctx) =>
        ctx.provide(
          "feedback",
          partialService<Services["feedback"]>({ error: () => {}, flash: () => {} }),
        ),
    },
  );
  const { createChannelsStore } = await import("../../../src/channels/client/store");
  const [bootstrap, setBootstrap] = createSignal<{
    channels: Channel[];
    starredChannelIds: ChannelId[];
  }>();
  const store = createRoot(() =>
    createChannelsStore({
      activeView: () => null,
      bootstrap,
      decorators: () => [],
      mutateUserPrefs: () => {},
      setActiveView: () => {},
      userPrefs: () => undefined,
    }),
  );
  return { setBootstrap, store };
}

test("bootstrap stars seed once and later bootstraps do not overwrite local toggles", async () => {
  const { setBootstrap, store } = await start();
  flush();
  expect(store.isChannelStarred(A)).toBe(false);
  setBootstrap({ channels: [], starredChannelIds: [A] });
  flush();
  expect(store.isChannelStarred(A)).toBe(true);
  setBootstrap({ channels: [], starredChannelIds: [B] });
  flush();
  expect(store.isChannelStarred(A)).toBe(true);
  expect(store.isChannelStarred(B)).toBe(false);
});
