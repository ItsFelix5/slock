import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import type { Services } from "@slock/core/types";
import type { Channel, ChannelId, UserPrefs } from "@slock/types";
import { provideUi } from "@slock/ui";
import { createEffect, createRoot, flush, getOwner, runWithOwner } from "solid-js";
import querySetup from "../../../../../packages/plugins/src/query/client/index";
import { createFakeEnv, type FakeEnv, partialService } from "../../../../support/core";
import { ch } from "../../../../support/slack";

const WRITES = /\/api\/(channels|sections|preferences)\/.+/;

export const A = ch("C1");
export const B = ch("C2");

type RawSection = {
  channel_ids: ChannelId[];
  id: string;
  name: string;
  sidebar: "all";
  type: string;
};

export const section = (id: string, channelIds: ChannelId[] = []): RawSection => ({
  channel_ids: channelIds,
  id,
  name: id,
  sidebar: "all",
  type: "standard",
});

const emptyPrefs = (): UserPrefs => ({
  channelFrecency: {},
  channelNotifications: {},
  channelSections: {},
  emojiUse: {},
  globalNotifications: {
    desktop: "all",
    desktopPushEnabled: true,
    keywords: [],
    mpdmDesktop: "all",
    noTextInNotifications: false,
    pushIdleWait: 2,
    pushShowPreview: true,
    threadsEverything: true,
  },
  highlightWords: [],
  mutedChannels: [],
  notifyAllChannels: [],
  sectionCollapsed: {},
  sectionSidebar: {},
  sectionSort: {},
});

const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status });
export const succeed = () => json({ ok: true });
export const reject = () => json({ error: "nope" }, 500);

export async function settle() {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flush();
  }
}

export async function startChannels(options: { sections?: RawSection[]; starred?: ChannelId[] }) {
  const env: FakeEnv = createFakeEnv(1, 1_000_000);
  const flashes: string[] = [];
  const host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register(
    { id: "ui", setup: provideUi },
    { id: "query", setup: querySetup },
    {
      id: "feedback",
      setup: (ctx) =>
        ctx.provide(
          "feedback",
          partialService<Services["feedback"]>({
            clear: () => {},
            error: () => {},
            flash: (_key, message) => flashes.push(message),
          }),
        ),
    },
  );
  const server = {
    refusesSections: false,
    sections: options.sections ?? [],
    starred: options.starred ?? [],
  };
  env.fetch.respond("/api/bootstrap", () => json({}));
  env.fetch.respond("/api/sections", () =>
    server.refusesSections
      ? json({ error: "no_permission" }, 403)
      : json({ channel_sections: server.sections }),
  );
  env.fetch.hold(WRITES);

  const { createChannelsStore } = await import(
    "../../../../../packages/plugins/src/channels/client/store"
  );
  const { defineQuery } = await import("../../../../../packages/plugins/src/query/client/api");
  const prefsQuery = defineQuery<null, UserPrefs>({
    load: async () => emptyPrefs(),
    name: "testPrefs",
  });
  const starredQuery = defineQuery<null, ChannelId[]>({
    load: async () => server.starred,
    name: "testStarred",
  });
  prefsQuery.set(null, emptyPrefs());
  starredQuery.set(null, server.starred);
  const root = createRoot((dispose) => {
    const prefsState = prefsQuery.state(() => null);
    const starredState = starredQuery.state(() => null);
    const prefs = () => prefsState().data;
    const store = createChannelsStore({
      bootstrap: () => ({
        channels: [] satisfies Channel[],
        starredChannelIds: starredState().data ?? [],
      }),
      decorators: () => [],
      overlayStarredIds: (change) => starredQuery.overlay(null, change),
      overlayUserPrefs: (change) => prefsQuery.overlay(null, change),
      setActiveView: () => {},
      userPrefs: prefs,
    });
    const owner = getOwner();
    const observe = <T>(read: () => T) => {
      const values: T[] = [];
      runWithOwner(owner, () =>
        createEffect(read, (value) => {
          if (values.at(-1) !== value) values.push(value);
        }),
      );
      return values;
    };
    createEffect(store.sections, () => {});
    return { dispose, observe, prefs, store };
  });
  flush();
  await settle();

  const answer = (match: string, response: Response) => {
    const call = env.fetch.pending().find((candidate) => candidate.url.includes(match));
    if (!call) throw new Error(`no pending request for ${match}`);
    call.resolve(response);
  };
  const callsTo = (match: string) => env.fetch.calls.filter((call) => call.url.includes(match));
  const requests = (match: string) => callsTo(match).length;
  const requestBodies = (match: string) => callsTo(match).map((call) => String(call.init?.body));

  return {
    ...root,
    answer,
    flashes,
    refreshStarred: () => starredQuery.refresh(null),
    requestBodies,
    requests,
    server,
    stop: () => {
      root.dispose();
      host.stop();
    },
  };
}
