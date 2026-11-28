import { describe, expect, test } from "bun:test";
import { trimDrafts } from "../../../../packages/plugins/src/drafts/server";
import type { RawDraft } from "../../../../packages/plugins/src/slack/server/api/slackReplies";

function draft(overrides: Partial<RawDraft>): RawDraft {
  return { client_msg_id: "cmid", destinations: [{ channel_id: "C1" }], id: "Dr1", ...overrides };
}

describe("trimDrafts", () => {
  test("keeps an unscheduled draft", () => {
    expect(trimDrafts([draft({ id: "Dr1" })]).map((d) => d.id)).toEqual(["Dr1"]);
  });

  test("leaves scheduled messages out of the drafts list", () => {
    const kept = trimDrafts([
      draft({ id: "Dr1", date_scheduled: 1_800_000_000 }),
      draft({ id: "Dr2", date_scheduled: "1800000000" }),
      draft({ id: "Dr3" }),
    ]);
    expect(kept.map((d) => d.id)).toEqual(["Dr3"]);
  });

  test("a zero schedule is an ordinary draft", () => {
    expect(trimDrafts([draft({ id: "Dr1", date_scheduled: 0 })]).map((d) => d.id)).toEqual(["Dr1"]);
  });
});
