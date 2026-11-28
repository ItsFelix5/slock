import { expect, test } from "bun:test";
import { mapSavedItem } from "../../../packages/slack/src/map/api";

test("a mapper rejects an id that is not shaped like Slack's", () => {
  expect(() => mapSavedItem({ channelId: "nope", ts: "2" })).toThrow(/not a channel id/);
});
