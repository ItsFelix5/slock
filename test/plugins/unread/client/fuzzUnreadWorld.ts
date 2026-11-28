import { createHost, defined } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import type { ChannelId, GatewayEvent } from "@slock/types";
import { provideUi } from "@slock/ui";
import { createRoot, flush } from "solid-js";
import { createBootstrapStore } from "../../../../packages/plugins/src/bootstrap/client/store";
import { createChannelsStore } from "../../../../packages/plugins/src/channels/client/store";
import { createDmsStore } from "../../../../packages/plugins/src/dms/client/store";
import querySetup from "../../../../packages/plugins/src/query/client/index";
import { createFeedback } from "../../../../packages/plugins/src/shell/client/feedback";
import unreadSetup from "../../../../packages/plugins/src/unread/client/index";
import { createFakeEnv } from "../../../support/core";
import { ch, stamp } from "../../../support/slack";
import { createFuzz, type FaultRates, quiesce, type ServedCall } from "../../fuzz/fuzzSlack";
import { createFakeCounts } from "./fakeCounts";

export const CHANNELS = ["C1", "C2", "C3"].map(ch);

const readPath = /^\/api\/channels\/([A-Z0-9]+)\/read$/;

export async function createUnreadWorld(
  seed: number,
  trace: string[],
  rates?: Partial<FaultRates>,
) {
  const env = createFakeEnv(seed);
  const server = createFakeCounts(env, CHANNELS);
  const host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register(
    { id: "feedback", setup: (ctx) => ctx.provide("feedback", createFeedback()) },
    { id: "ui", setup: provideUi },
    { id: "query", setup: querySetup },
  );
  let disposeStores = () => {};
  const stores = createRoot((dispose) => {
    disposeStores = dispose;
    const bootstrap = createBootstrapStore({ retryHooks: () => [] });
    const data = () => bootstrap.bootstrap().data;
    return {
      bootstrap,
      channels: createChannelsStore({
        bootstrap: data,
        decorators: () => [],
        overlayStarredIds: (change) =>
          bootstrap.overlayBootstrap((current) => ({
            ...current,
            starredChannelIds: change(current.starredChannelIds),
          })),
        overlayUserPrefs: bootstrap.overlayUserPrefs,
        setActiveView: () => {},
        userPrefs: () => undefined,
      }),
      dms: createDmsStore({
        activeView: () => null,
        addJoinedChannel: () => {},
        bootstrap: data,
        closeUserProfile: () => {},
        currentUser: () => undefined,
        openInPane: () => "",
        setActiveView: () => {},
        showAsChannel: () => {},
      }),
    };
  });
  await host.register(
    { id: "bootstrap", setup: (ctx) => ctx.provide("bootstrap", stores.bootstrap) },
    {
      id: "channels",
      requires: ["bootstrap"],
      setup: (ctx) => ctx.provide("channels", stores.channels),
    },
    { id: "dms", requires: ["bootstrap"], setup: (ctx) => ctx.provide("dms", stores.dms) },
    { id: "unread", requires: ["bootstrap", "channels", "dms"], setup: unreadSetup },
  );
  server.releaseBootstrap();
  await quiesce();

  const unread = defined(host.service("unread"));
  const { channels } = stores;
  const inflight: Promise<unknown>[] = [];
  const seen = new Map<ChannelId, number>();

  const deliver = (event: GatewayEvent) => {
    for (const handler of host.items("realtime.handler"))
      if (handler.types.includes(event.type)) handler.run(event);
    flush();
  };

  const onServed = ({ method, path }: ServedCall) => {
    const match = readPath.exec(path);
    if (method !== "POST" || !match?.[1]) return;
    const id = ch(match[1]);
    const event = server.markedEvent(id);
    fuzz.emit(`marked ${id}`, () => deliver(event));
  };
  const fuzz = createFuzz({ env, onServed, rates, seed, trace });

  return {
    channel(id: ChannelId) {
      flush();
      return {
        mentions: channels.channelById(id)?.mentions ?? 0,
        unread: unread.isChannelUnread(id),
      };
    },
    env,
    fuzz,
    incoming(id: ChannelId, mention: boolean) {
      const ts = server.post(id, mention);
      const event = server.badgeEvent(id);
      fuzz.emit(`incoming ${id}`, () => {
        seen.set(id, Math.max(seen.get(id) ?? 0, ts));
        deliver(event);
      });
    },
    read(id: ChannelId) {
      const ts = seen.get(id);
      if (ts === undefined) return;
      unread.clearChannelUnread(id);
      inflight.push(unread.setChannelRead(id, stamp(server.stampOf(ts))).catch(() => undefined));
    },
    readElsewhere(id: ChannelId) {
      server.readAll(id);
      const event = server.markedEvent(id);
      fuzz.emit(`marked elsewhere ${id}`, () => deliver(event));
    },
    refresh() {
      for (const run of host.items("realtime.reconnect")) run();
    },
    server,
    async settle() {
      for (let round = 0; round < 3; round++) {
        await fuzz.drain();
        await Promise.all(inflight);
        env.advance(1000);
      }
      await fuzz.drain();
    },
    stop() {
      disposeStores();
      return host.stop();
    },
  };
}

export type UnreadWorld = Awaited<ReturnType<typeof createUnreadWorld>>;
