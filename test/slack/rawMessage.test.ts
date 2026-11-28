import { expect, test } from "bun:test";
import { botTeamIdOf } from "../../packages/slack/src/rawMessage";
import { tid } from "../support/slack";

test("takes a bot's workspace from its profile, but not an organisation id", () => {
  expect(botTeamIdOf({ bot_profile: { team_id: "T2" } })).toBe(tid("T2"));
  expect(botTeamIdOf({ bot_profile: { team_id: "E2" } })).toBeUndefined();
  expect(botTeamIdOf({})).toBeUndefined();
});
