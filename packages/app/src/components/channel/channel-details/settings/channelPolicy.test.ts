// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { memberPermissionPatch, retentionValue } from "./channelPolicy";

describe("channel settings policy mapping", () => {
  test("changes only the explicitly selected member permission", () => {
    expect(memberPermissionPatch("invite", "restrict")).toEqual({
      invite: false,
      setPurpose: undefined,
      setTopic: undefined,
    });
    expect(memberPermissionPatch("topic", "allow")).toEqual({
      invite: undefined,
      setPurpose: undefined,
      setTopic: true,
    });
  });

  test("maps an explicit retention choice without inventing a default", () => {
    expect(retentionValue("keep", 90)).toBeNull();
    expect(retentionValue("delete", 45)).toBe(45);
  });
});
