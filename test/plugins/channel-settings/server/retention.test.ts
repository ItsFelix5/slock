import { describe, expect, test } from "bun:test";
import setup from "../../../../packages/plugins/src/channel-settings/server/index";
import { fakeSlackServer } from "../../../support/slackServer";

const { replies, request, sent } = fakeSlackServer("channel-settings", setup);

describe("channel retention", () => {
  test.each([
    ["the workspace default", { retention_duration: 0, retention_type: 0 }, null],
    ["a day limit", { retention_duration: 30, retention_type: 1 }, 30],
  ])("reads %s", async (_name, retention, days) => {
    replies["conversations.getRetention"] = { ok: true, retention };
    const { json } = await request("/api/channels/C1/retention");
    expect(json.days).toBe(days);
  });

  test("sends a day limit", async () => {
    await request("/api/channels/C1/retention", { days: 30 }, "PUT");
    expect(sent("conversations.setRetention")).toMatchObject({
      retention_duration: "30",
      retention_type: "1",
    });
  });

  test("returns to the default without a duration", async () => {
    await request("/api/channels/C1/retention", { days: null }, "PUT");
    const params = sent("conversations.setRetention");
    expect(params.retention_type).toBe("0");
    expect(params.retention_duration).toBeUndefined();
  });
});
