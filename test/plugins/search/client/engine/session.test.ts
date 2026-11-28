import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { createHost, PluginDef } from "@slock/core";
import type { Services } from "@slock/core/types";
import { mapUser, parseChannelId } from "@slock/slack";
import type { Channel, DirectMessage, User } from "@slock/types";
import { createRoot, createSignal, flush } from "solid-js";
import type { OpenableRow } from "../../../../../packages/plugins/src/search/client/engine/rows";
import { createSearchSession } from "../../../../../packages/plugins/src/search/client/engine/session";
import {
  DEFAULT_INPUTS,
  type SearchInputs,
} from "../../../../../packages/plugins/src/search/client/searchQuery";
import { createFakeEnv, type FakeEnv, partialService } from "../../../../support/core";
import { elapse, jsonReply, settle, startQueryHost } from "../../../../support/queryHost";

let env: FakeEnv;
let host: ReturnType<typeof createHost>;
let dispose = () => {};
let remoteUsers: PromiseWithResolvers<User[]>[];

const [channels, setChannels] = createSignal<Channel[]>([], { ownedWrite: true });

const [directMessages] = createSignal<DirectMessage[]>([]);

const channel = (id: string, name: string) =>
  partialService<Channel>({ id: parseChannelId(id), name, private: false });

function fake<Id extends keyof Services>(
  id: Id,
  members: Partial<Services[Id] & object>,
): PluginDef {
  return {
    id,
    setup: (ctx) => ctx.provide(id, partialService<Services[Id] & object>(members)),
  };
}

beforeEach(async () => {
  env = createFakeEnv();
  remoteUsers = [];
  setChannels([channel("C1", "general")]);
  host = await startQueryHost(
    env,
    fake("bootstrap", { bootstrap: () => ({ data: {} }) as never }),
    fake("channels", { channels }),
    fake("dms", { directMessages, dmIdForUser: () => undefined }),
    fake("prefs", { frecencyScore: () => 0, recentIds: () => [] }),
    fake("titles", {}),
    fake("users", {
      knownUsers: () => [],
      searchUsers: () => {
        const reply = Promise.withResolvers<User[]>();
        remoteUsers.push(reply);
        return reply.promise;
      },
    }),
  );
  env.fetch.respond(/\/api\/channels\/browse/, () => jsonReply({ items: [], ok: true }));
  env.fetch.respond(/\/api\/search\/files\/titles/, () => jsonReply({ files: [], ok: true }));
});

afterEach(() => {
  dispose();
  host.stop();
});

function start(initial: Partial<SearchInputs> = {}) {
  const opened: string[] = [];
  const session = createRoot((stop) => {
    dispose = stop;
    return createSearchSession({
      initial: { ...DEFAULT_INPUTS, ...initial },
      jumpOnly: false,
      open: (row: OpenableRow) => void opened.push(row.id),
      writeInput: () => {},
    });
  });
  const type = async (query: string) => {
    session.setQuery(query);
    flush();
    await elapse(env, 500);
  };
  const answer = async (index: number, ...names: string[]) => {
    remoteUsers[index]?.resolve(
      names.map((name) => mapUser({ id: `U${name.toUpperCase()}`, name })),
    );
    await settle();
  };
  const ids = () => session.rows().map((row) => row.id);
  return { answer, ids, opened, session, type };
}

describe("search session", () => {
  test("rows appear only once every source has answered", async () => {
    const view = start();
    await view.type("gen");
    expect(view.ids()).toEqual([]);
    expect(view.session.busy()).toBe(true);
    await view.answer(0, "genie");
    expect(view.ids()).toContain("C1");
    expect(view.ids()).toContain("UGENIE");
    expect(view.session.busy()).toBe(false);
  });

  test("committed rows ignore later local changes", async () => {
    const view = start();
    await view.type("gen");
    await view.answer(0);
    const rows = view.session.rows();
    setChannels([channel("C2", "gen"), channel("C1", "general")]);
    await settle();
    expect(view.session.rows()).toBe(rows);
  });

  test("old rows stay while the next query loads", async () => {
    const view = start();
    await view.type("gen");
    await view.answer(0);
    const before = view.ids();
    await view.type("gene");
    expect(view.ids()).toEqual(before);
  });

  test("a late answer to an old query changes nothing", async () => {
    const view = start();
    await view.type("gen");
    await view.type("gene");
    await view.answer(1, "fresh");
    const rows = view.ids();
    await view.answer(0, "stale");
    expect(view.ids()).toEqual(rows);
  });

  test("enter before results opens the best match once", async () => {
    const view = start();
    view.session.setQuery("gen");
    flush();
    view.session.submit(false);
    await settle();
    expect(view.opened).toEqual([]);
    await view.answer(0);
    await settle();
    expect(view.opened).toEqual(["C1"]);
  });

  test("typing after enter cancels the queued open", async () => {
    const view = start();
    view.session.setQuery("gen");
    flush();
    view.session.submit(false);
    await view.type("gene");
    await view.answer(remoteUsers.length - 1);
    expect(view.opened).toEqual([]);
  });

  test("message search waits for enter and then lists history", async () => {
    env.fetch.respond(/\/api\/search\/history/, () =>
      jsonReply({ entries: [{ hash: "h1", text: "old search" }], ok: true }),
    );
    const view = start({ scope: "messages" });
    await elapse(env, 500);
    expect(view.ids()).toEqual(["h1"]);
    expect(view.session.activeIndex()).toBe(null);
  });
});
