import { expect, spyOn, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv, partialService } from "@slock/core/testing";
import type { Services } from "@slock/core/types";
import { ch } from "@slock/slack/testing";
import { createRoot, flush } from "solid-js";

const CHANNEL = ch("C1");

async function start(options: { failApps?: boolean; list?: HTMLElement; pages?: number } = {}) {
  const { failApps = false, list, pages = 1 } = options;
  const loads: string[] = [];
  const host = createHost({ env: createFakeEnv(1, 1_000_000), reactive: solidReactive });
  setHost(host);
  await host.register({
    id: "services",
    setup: (ctx) => {
      ctx.provide("shell.dialogs", partialService<Services["shell.dialogs"]>({}));
      ctx.provide("channels", partialService<Services["channels"]>({}));
      ctx.provide("users", partialService<Services["users"]>({ userById: () => undefined }));
      ctx.provide(
        "channel-details",
        partialService<Services["channel-details"]>({
          loadChannelManagerIds: () => Promise.resolve([]),
          loadChannelMembersPage: (_id, filter) => {
            loads.push(filter);
            if (failApps && filter === "apps") return Promise.reject(new Error("no"));
            const more = loads.filter((f) => f === filter).length < pages;
            return Promise.resolve({ members: [], nextCursor: more ? "next" : undefined });
          },
        }),
      );
    },
  });
  const { createChannelMembers } = await import(
    "../../../src/channel-members/client/channelMembers"
  );
  const members = createRoot(() =>
    createChannelMembers({
      channelId: () => CHANNEL,
      channelName: () => "general",
      list: () => list,
      memberCount: () => 0,
    }),
  );
  const settle = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      flush();
    }
  };
  await settle();
  return { loads, members, settle };
}

test("each filter loads its first page once and revisiting a loaded filter does not reload", async () => {
  const warn = spyOn(console, "warn");
  const { loads, members, settle } = await start();
  expect(loads).toEqual(["everyone"]);
  members.setFilter("apps");
  await settle();
  members.setFilter("everyone");
  await settle();
  members.setFilter("apps");
  await settle();
  expect(loads).toEqual(["everyone", "apps"]);
  expect(warn).not.toHaveBeenCalled();
});

test("a filter that failed to load is retried when it is selected again", async () => {
  const { loads, members, settle } = await start({ failApps: true });
  members.setFilter("apps");
  await settle();
  expect(members.loadError()).toBe(true);
  members.setFilter("everyone");
  await settle();
  members.setFilter("apps");
  await settle();
  expect(loads).toEqual(["everyone", "apps", "apps"]);
});

function listWithHeight(scrollHeight: number, clientHeight: number) {
  const list = document.createElement("div");
  Object.defineProperty(list, "scrollHeight", { value: scrollHeight });
  Object.defineProperty(list, "clientHeight", { value: clientHeight });
  return list;
}

test("keeps loading pages while the list is too short to scroll", async () => {
  const { loads } = await start({ list: listWithHeight(100, 400), pages: 3 });
  expect(loads).toEqual(["everyone", "everyone", "everyone"]);
});

test("stops loading when the list is scrollable and the end is far away", async () => {
  const { loads } = await start({ list: listWithHeight(2000, 400), pages: 3 });
  expect(loads).toEqual(["everyone"]);
});
