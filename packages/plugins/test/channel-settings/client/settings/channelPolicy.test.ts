import { describe, expect, test } from "bun:test";
import { forAll, pick } from "@slock/core/testing";
import {
  memberPermissionsDirty,
  memberPermissionsPatch,
  type PermissionChoice,
  type PermissionDraft,
  retentionValue,
} from "../../../../src/channel-settings/client/settings/channelPolicy";

const draft = (current: PermissionChoice, committed: PermissionChoice): PermissionDraft => ({
  committed,
  current,
});
const unchanged = draft("allow", "allow");
const choices: PermissionChoice[] = ["", "allow", "restrict"];

describe("memberPermissionsDirty", () => {
  test("clean when every draft matches or is untouched", () => {
    expect(
      memberPermissionsDirty({ invite: unchanged, purpose: unchanged, topic: unchanged }),
    ).toBe(false);
    const untouched = draft("", "restrict");
    expect(
      memberPermissionsDirty({ invite: untouched, purpose: untouched, topic: untouched }),
    ).toBe(false);
  });

  test("dirty when any one draft differs", () => {
    const changed = draft("restrict", "allow");
    expect(memberPermissionsDirty({ invite: changed, purpose: unchanged, topic: unchanged })).toBe(
      true,
    );
    expect(memberPermissionsDirty({ invite: unchanged, purpose: unchanged, topic: changed })).toBe(
      true,
    );
  });

  test("dirty exactly when the patch carries something", () => {
    forAll(
      (random) => ({
        invite: draft(pick(random, choices), pick(random, choices)),
        purpose: draft(pick(random, choices), pick(random, choices)),
        topic: draft(pick(random, choices), pick(random, choices)),
      }),
      (drafts) => {
        const patch = memberPermissionsPatch(drafts);
        const carries = Object.values(patch).some((value) => value !== undefined);
        expect(memberPermissionsDirty(drafts)).toBe(carries);
      },
    );
  });
});

describe("memberPermissionsPatch", () => {
  test("only includes changed fields and maps allow to true", () => {
    expect(
      memberPermissionsPatch({
        invite: draft("allow", "restrict"),
        purpose: unchanged,
        topic: draft("restrict", "allow"),
      }),
    ).toEqual({ invite: true, setPurpose: undefined, setTopic: false });
  });

  test("an untouched draft stays out of the patch even when committed differs", () => {
    expect(
      memberPermissionsPatch({
        invite: draft("", "allow"),
        purpose: draft("", "restrict"),
        topic: draft("", ""),
      }),
    ).toEqual({ invite: undefined, setPurpose: undefined, setTopic: undefined });
  });
});

describe("retentionValue", () => {
  test("keep means no limit and delete means the number of days", () => {
    expect(retentionValue("keep", 30)).toBeNull();
    expect(retentionValue("delete", 30)).toBe(30);
    expect(retentionValue("delete", 0)).toBe(0);
  });
});
