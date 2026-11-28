import { expect, spyOn, test } from "bun:test";
import { trimAttachment } from "../../../../../packages/plugins/src/slack/server/api/trim/slackMessages";

test("keeps the app behind an attachment and silences fields the client never sends", () => {
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  const raw = {
    app_id: "A1",
    app_unfurl_url: "https://example.com",
    bot_id: "B1",
    bot_team_id: "T1",
    channel_team: "T2",
    id: 1,
    is_app_unfurl: true,
    is_share: true,
  };
  expect(trimAttachment(raw)).toMatchObject({ bot_id: "B1", bot_team_id: "T1", id: 1 });
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});
