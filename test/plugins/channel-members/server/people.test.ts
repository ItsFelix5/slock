import { describe, expect, test } from "bun:test";
import setup from "../../../../packages/plugins/src/channel-members/server";
import { fakeSlackServer } from "../../../support/slackServer";

const slack = fakeSlackServer("channel-members", setup);

describe("people count", () => {
  test("asks like the web client and returns only the humans", async () => {
    slack.replies["users/counts"] = { counts: { everyone: 3, people: 2 }, ok: true };
    const { json } = await slack.request("/api/channels/C1/people-count");
    expect(json).toEqual({ people: 2 });
    expect(slack.sent("users/counts")).toMatchObject({ as_admin: "false", channel: "C1" });
  });

  test("an unreadable channel has no count", async () => {
    slack.replies["users/counts"] = { error: "channel_not_found", ok: false };
    const { json } = await slack.request("/api/channels/C1/people-count");
    expect(json).toEqual({});
  });
});

describe("people list", () => {
  test("follows markers and drops deactivated users", async () => {
    slack.replies["users/list"] = (params) =>
      params.has("marker")
        ? { ok: true, results: [{ id: "U3" }] }
        : { next_marker: "two", ok: true, results: [{ id: "U1" }, { deleted: true, id: "U2" }] };
    const { json } = await slack.request("/api/channels/C1/people");
    expect(json).toEqual({ complete: true, ids: ["U1", "U3"] });
    expect(slack.sent("users/list")).toMatchObject({
      filter: "everyone AND NOT bots AND NOT apps",
    });
  });

  test("stops at five pages and says the list is partial", async () => {
    slack.replies["users/list"] = { next_marker: "more", ok: true, results: [{ id: "U1" }] };
    const { json } = await slack.request("/api/channels/C1/people");
    expect(json).toMatchObject({ complete: false });
    expect(slack.calls).toHaveLength(5);
  });
});
