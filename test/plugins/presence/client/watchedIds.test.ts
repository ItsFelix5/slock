import { expect, test } from "bun:test";
import { parseUserId, SLACK_USER_ID } from "@slock/slack";
import { watchedUserIds } from "../../../../packages/plugins/src/presence/client/watchedIds";

const A = parseUserId("UA");
const B = parseUserId("UB");
const ME = parseUserId("UME");

test("collects dm users, group members and yourself without duplicates", () => {
  const ids = watchedUserIds([{ userId: A }, { memberIds: [A, B] }, {}], ME);
  expect(ids).toEqual([A, B, ME]);
});

test("slackbot is never watched and being signed out adds nobody", () => {
  expect(watchedUserIds([{ userId: SLACK_USER_ID }, { userId: A }], undefined)).toEqual([A]);
});
