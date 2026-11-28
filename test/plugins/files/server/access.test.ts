import { describe, expect, test } from "bun:test";
import setup from "../../../../packages/plugins/src/files/server/index";
import { fakeSlackServer } from "../../../support/slackServer";

const { replies, request, sent, slackMethods } = fakeSlackServer("files", setup);

const canvas = {
  access: "write",
  filetype: "quip",
  id: "F1",
  org_or_workspace_access: "comment",
  user: "U1",
  user_team: "E1",
};

function slackHolds(file: object) {
  replies["files.info"] = { file, ok: true };
  replies["files.getShares"] = {
    conversation_shares: {
      shares: { public: { C9: [{ channel_name: "general", ts: "1.0" }] } },
    },
    ok: true,
  };
  replies["files.getMetadata"] = (params) =>
    params.get("type") === "channels"
      ? {
          entities: [{ access: "write", channel_id: "C1", is_private: true }],
          ok: true,
          private_channel_count: 2,
        }
      : {
          entities: [
            { access: "owner", can_update: "can_update", user_id: "U1" },
            { access: "write", can_update: "cannot_downgrade_channel_edit", user_id: "U2" },
          ],
          ok: true,
        };
  replies["team.info"] = { ok: true, team: { name: "Acme" } };
}

const access = async () => (await request("/api/files/F1/detail")).json.access;

describe("file access list", () => {
  test("a canvas lists what Slack's share dialog lists", async () => {
    slackHolds(canvas);
    expect(await access()).toEqual({
      can_manage: true,
      channels: [{ access: "write", channel_id: "C1", private: true }],
      hidden_channels: 2,
      org_id: "E1",
      org_level: "comment",
      org_name: "Acme",
      users: [
        { access: "owner", user_id: "U1" },
        { access: "write", edit_held_by: "channel", user_id: "U2" },
      ],
    });
  });

  test.each([
    ["a viewer", { access: "read" }, false],
    ["a locked canvas", { is_locked: true }, false],
    ["an editor under restricted sharing", { is_restricted_sharing_enabled: true }, false],
    [
      "the owner under restricted sharing",
      { access: "owner", is_restricted_sharing_enabled: true },
      true,
    ],
  ])("decides who manages: %s", async (_name, change, expected) => {
    slackHolds({ ...canvas, ...change });
    expect((await access()).can_manage).toBe(expected);
  });

  test("is unknown when Slack refuses the list", async () => {
    slackHolds(canvas);
    replies["files.getMetadata"] = { error: "nope", ok: false };
    expect(await access()).toBeNull();
  });

  test("another file lists its shares and cannot be managed", async () => {
    slackHolds({ ...canvas, filetype: "png" });
    expect(await access()).toMatchObject({
      can_manage: false,
      channels: [{ access: "read", channel_id: "C9", name: "general" }],
    });
    expect(slackMethods()).not.toContain("files.getMetadata");
  });
});

describe("file access changes", () => {
  const grant = { level: "comment", orgId: "E1" };

  test("a new channel gets a silent share", async () => {
    await request("/api/files/F1/access", { ...grant, channelId: "C1" });
    expect(slackMethods()).toEqual(["files.share"]);
    expect(sent("files.share")).toMatchObject({
      channel: "C1",
      permissions: JSON.stringify([{ file_id: "F1", grant: "comment" }]),
      silent_share: "true",
    });
  });

  test("a new person gets the share in their DM", async () => {
    replies["conversations.open"] = { channel: { id: "D1" }, ok: true };
    await request("/api/files/F1/access", { ...grant, userId: "U2" });
    expect(slackMethods()).toEqual(["conversations.open", "files.share"]);
    expect(sent("files.share").channel).toBe("D1");
  });

  test("a level change updates the permission", async () => {
    await request("/api/files/F1/access", { ...grant, userId: "U2" }, "PUT");
    expect(sent("files.updatePermission")).toMatchObject({
      team_id: "E1",
      user_id_access_level_map: JSON.stringify([{ access_level: "comment", user_id: "U2" }]),
    });
  });

  test("a level change Slack skipped counts as a failure", async () => {
    replies["files.updatePermission"] = { failed_to_update_channel_ids: ["C1"], ok: true };
    const { status } = await request("/api/files/F1/access", { ...grant, channelId: "C1" }, "PUT");
    expect(status).toBe(502);
  });

  test("removing revokes the permission", async () => {
    await request("/api/files/F1/access/remove", { channelId: "C1", orgId: "E1" });
    expect(sent("files.revokePermission")).toMatchObject({
      channel_id: "C1",
      file_id: "F1",
      team_id: "E1",
    });
  });

  test.each([
    ["E1", "org"],
    ["T1", "workspace"],
  ])("general access on %s targets the %s", async (orgId, type) => {
    await request("/api/files/F1/org-access", { level: "read", orgId });
    expect(sent("files.enableCrossWorkspaceLinkSharing").entity_type).toBe(type);
  });
});
