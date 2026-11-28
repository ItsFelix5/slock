import { describe, expect, test } from "bun:test";
import type { RawUser } from "@slock/types";
import { mapBot } from "../../../packages/plugins/src/users/client/requests";
import { SLACK_SYSTEM_USER } from "../../../packages/plugins/src/users/client/store";
import {
  mapCustomFields,
  mapUser,
  profileName,
  SLACK_USER_ID,
} from "../../../packages/slack/src/map/users";
import { forAll } from "../../support/core";
import { uid } from "../../support/slack";
import { garbageRecord, USER_SPEC, viaJson } from "../garbage";

describe("mapUser", () => {
  test("prefers display name, then real name, then handle", () => {
    expect(
      mapUser({
        id: "U1",
        name: "handle",
        profile: { display_name: "Dee", real_name: "Dee Real" },
      }),
    ).toMatchObject({
      name: "Dee",
      realName: "Dee Real",
    });
    expect(mapUser({ id: "U1", name: "handle", profile: { real_name: "Real" } })).toMatchObject({
      name: "Real",
      realName: undefined,
    });
    expect(mapUser({ id: "U1", name: "handle" }).name).toBe("handle");
    expect(mapUser({ id: "U1" }).name).toBe("");
  });

  test("avatar prefers the largest image", () => {
    const user = mapUser({ id: "U1", profile: { image_48: "s", image_192: "l" } });
    expect(user.avatarUrl).toBe("l");
  });

  test("the Slack system user and slackbot are bots", () => {
    expect(SLACK_SYSTEM_USER).toMatchObject({
      avatarColor: "transparent",
      id: SLACK_USER_ID,
      isBot: true,
    });
    expect(mapUser({ id: "USLACKBOT" })).toMatchObject({ isBot: true });
    expect(mapUser({ id: "USLACKBOT" }).avatarUrl).toContain("slackbot");
  });

  test("owners are also admins", () => {
    expect(mapUser({ id: "U1", is_owner: true })).toMatchObject({
      isWorkspaceAdmin: true,
      isWorkspaceOwner: true,
    });
    expect(mapUser({ id: "U1", is_admin: true })).toMatchObject({
      isWorkspaceAdmin: true,
      isWorkspaceOwner: false,
    });
  });

  test("only known presence values pass through", () => {
    expect(mapUser({ id: "U1", presence: "active" }).presence).toBe("active");
    expect(mapUser({ id: "U1", presence: "dnd" }).presence).toBeUndefined();
  });

  test.each([
    [0, "UTC+0"],
    [3600, "UTC+1"],
    [-18000, "UTC-5"],
    [19800, "UTC+5:30"],
    [20700, "UTC+5:45"],
    [-12600, "UTC-3:30"],
    [3599, "UTC+1"],
  ])("tz offset %d renders as %s", (offset, label) => {
    expect(mapUser({ id: "U1", tz_offset: offset }).tzLabel).toBe(label);
  });

  test("never throws on garbage and keeps the id", () => {
    forAll(
      (random) => ({ ...garbageRecord(random, USER_SPEC), id: "U9" }),
      (garbage) => {
        expect(mapUser(viaJson<RawUser>(garbage)).id).toBe(uid("U9"));
      },
      500,
    );
  });
});

describe("profile helpers", () => {
  test("custom fields drop empty values", () => {
    const fields = mapCustomFields({
      fields: { A: { alt: "", value: "x" }, B: { alt: "", value: "" } },
    });
    expect(fields).toEqual([{ alt: undefined, id: "A", value: "x" }]);
    expect(mapCustomFields({ fields: {} })).toBeUndefined();
    expect(mapCustomFields(undefined)).toBeUndefined();
  });

  test("profileName skips empty names", () => {
    expect(profileName({ display_name: "", real_name: "Real" })).toBe("Real");
    expect(profileName(undefined)).toBe("");
  });

  test("mapBot uses the bot id as user id", () => {
    expect(mapBot({ app_id: "A1", icons: { image_48: "i" }, id: "B1", name: "bot" })).toMatchObject(
      {
        appId: "A1",
        avatarUrl: "i",
        botId: "B1",
        id: "B1",
        isBot: true,
      },
    );
  });
});
