import { expect, test } from "bun:test";
import type { Channel, RawChannel } from "@slock/types";
import { createRoot, flush } from "solid-js";
import { createFakeEnv } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";
import { ch, uid } from "../../../support/slack";

const GROUP = ch("C1");

test("a group chat follows renames, cleared names and conversion to a channel", async () => {
  const env = createFakeEnv(1, 1_000_000);
  let remote: RawChannel = {
    id: GROUP,
    is_mpim: true,
    members: ["UME", "UANA", "UBO"],
    name: "mpdm-me--ana--bo-1",
  };
  env.fetch.respond(
    "/api/channels/C1",
    () => new Response(JSON.stringify({ channel: remote, ok: true }), { status: 200 }),
  );
  await startQueryHost(env);
  const { createDmsStore } = await import("../../../../packages/plugins/src/dms/client/store");

  const joined: Channel[] = [];
  const retargeted: string[] = [];
  const store = createRoot(() =>
    createDmsStore({
      activeView: () => null,
      addJoinedChannel: (channel) => joined.push(channel),
      bootstrap: () => undefined,
      closeUserProfile: () => {},
      currentUser: () => ({ avatarColor: "#000", id: uid("UME"), name: "Me" }),
      openInPane: () => "",
      setActiveView: () => {},
      showAsChannel: (id) => retargeted.push(id),
    }),
  );
  const sync = async (patch: Partial<RawChannel>) => {
    remote = { ...remote, ...patch };
    await store.refreshGroupDm(GROUP);
    flush();
    return store.dmById(GROUP);
  };

  await store.ensureMpdm(GROUP);
  flush();
  expect(store.isGroupDm(GROUP)).toBe(true);
  expect(store.dmById(GROUP)?.memberIds).toEqual([uid("UANA"), uid("UBO")]);

  expect((await sync({ name: "Crew", topic: { value: "plans" } }))?.name).toBe("Crew");
  expect(store.dmById(GROUP)?.topic).toBe("plans");

  expect((await sync({ name: "mpdm-me--ana--bo-1" }))?.name).toBeUndefined();

  expect(await sync({ is_mpim: false, is_private: true, name: "crew" })).toBeUndefined();
  expect(joined.map((channel) => channel.name)).toEqual(["crew"]);
  expect(retargeted).toEqual([GROUP]);
});
