import { describe, expect, test } from "bun:test";
import { parseUserId } from "@slock/slack";
import type { Channel, MembershipEvent } from "@slock/types";
import { createMembershipHandler } from "../../../../packages/plugins/src/channels/client/membershipEvents";

function setup(currentUserId: string | undefined = "UME") {
  const calls: string[] = [];
  const handle = createMembershipHandler(
    {
      addJoinedChannel: (channel: Channel) => calls.push(`join:${channel.id}:${channel.name}`),
      invalidateChannelRoster: (id) => calls.push(`roster:${id}`),
      markChannelLeft: (id) => calls.push(`left:${id}`),
      patchChannel: (id, patch) => calls.push(`patch:${id}:${JSON.stringify(patch)}`),
    },
    () =>
      currentUserId
        ? { avatarColor: "#000", id: parseUserId(currentUserId), name: "Me" }
        : undefined,
  );
  return { calls, handle };
}

describe("membership events", () => {
  test("joining maps the raw channel into the store", () => {
    const { calls, handle } = setup();
    handle({ channel: { id: "C1", name: "general" }, type: "channel_joined" });
    handle({ channel: { id: "G1", is_private: true, name: "secret" }, type: "group_joined" });
    expect(calls).toEqual(["join:C1:general", "join:G1:secret"]);
  });

  test.each([
    "channel_left",
    "group_left",
    "channel_deleted",
  ] as const)("%s marks the channel left", (type) => {
    const { calls, handle } = setup();
    handle({ channel: "C1", type });
    expect(calls).toEqual(["left:C1"]);
  });

  test("another user leaving only refreshes the roster", () => {
    const { calls, handle } = setup();
    handle({ channel: "C1", type: "member_left_channel", user: "UOTHER" });
    expect(calls).toEqual(["roster:C1"]);
  });

  test("the current user leaving marks the channel left", () => {
    const { calls, handle } = setup();
    handle({ channel: "C1", type: "member_left_channel", user: "UME" });
    expect(calls).toEqual(["left:C1"]);
  });

  test("someone joining refreshes the roster", () => {
    const { calls, handle } = setup();
    handle({ channel: "C1", type: "member_joined_channel", user: "UOTHER" });
    expect(calls).toEqual(["roster:C1"]);
  });

  test("renames patch the name and skip payloads without an id", () => {
    const { calls, handle } = setup();
    handle({ channel: { id: "C1", name: "new" }, type: "channel_rename" });
    handle({ channel: { name: "orphan" }, type: "group_rename" });
    expect(calls).toEqual(['patch:C1:{"name":"new"}']);
  });

  test.each([
    ["channel_archive", true],
    ["group_archive", true],
    ["channel_unarchive", false],
    ["group_unarchive", false],
  ] as const)("%s sets archived to %p", (type, archived) => {
    const { calls, handle } = setup();
    handle({ channel: "C1", type });
    expect(calls).toEqual([`patch:C1:{"archived":${archived}}`]);
  });

  test("events without a channel id do nothing", () => {
    const { calls, handle } = setup();
    const events: MembershipEvent[] = [
      { type: "channel_left" },
      { type: "member_joined_channel" },
      { type: "member_left_channel" },
      { type: "channel_archive" },
      { type: "group_unarchive" },
      { type: "channel_deleted" },
    ];
    for (const event of events) handle(event);
    expect(calls).toEqual([]);
  });

  test("a leave without a known current user does not mark the channel left", () => {
    const { calls, handle } = setup(undefined);
    handle({ channel: "C1", type: "member_left_channel", user: "UOTHER" });
    expect(calls).toEqual(["roster:C1"]);
  });
});
