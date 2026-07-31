// biome-ignore-all lint/style/useNamingConvention: Expected objects mirror Slack's wire payload.
// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { serializeMemberPermissionsPatch } from "@slock/slack-api";

describe("serializeMemberPermissionsPatch", () => {
  test("only includes the permission the user changed", () => {
    expect(serializeMemberPermissionsPatch({ invite: false })).toEqual([
      { is_allowed: false, permission: "INVITE_TO_CHANNEL" },
    ]);
  });

  test("preserves explicit false values while omitting absent settings", () => {
    expect(serializeMemberPermissionsPatch({ setPurpose: false, setTopic: true })).toEqual([
      { is_allowed: false, permission: "SET_CHANNEL_PURPOSE" },
      { is_allowed: true, permission: "SET_CHANNEL_TOPIC" },
    ]);
    expect(serializeMemberPermissionsPatch({})).toEqual([]);
  });
});
