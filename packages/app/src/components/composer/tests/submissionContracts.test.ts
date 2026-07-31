// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { draftCacheKey, submitComposerPayload } from "../lib/submission";

describe("composer destination keys", () => {
  test("keeps equal thread timestamps isolated by channel", () => {
    expect(draftCacheKey("C1", "123.456")).toBe("C1:thread:123.456");
    expect(draftCacheKey("C2", "123.456")).toBe("C2:thread:123.456");
  });
});

describe("submitComposerPayload", () => {
  test("clears the submitted state only after success", async () => {
    let cleared = false;
    await submitComposerPayload({
      files: [],
      isSlashAttempt: false,
      onSuccess: () => {
        cleared = true;
      },
      runCommand: () => Promise.resolve({ handled: false, succeeded: false }),
      sendMessage: () => Promise.resolve(),
      uploadFiles: () => Promise.resolve(),
    });
    expect(cleared).toBe(true);
  });

  test("preserves submitted state when the action fails", async () => {
    let cleared = false;
    await expect(
      submitComposerPayload({
        files: [],
        isSlashAttempt: false,
        onSuccess: () => {
          cleared = true;
        },
        runCommand: () => Promise.resolve({ handled: false, succeeded: false }),
        sendMessage: () => Promise.reject(new Error("offline")),
        uploadFiles: () => Promise.resolve(),
      }),
    ).rejects.toThrow("offline");
    expect(cleared).toBe(false);
  });

  test("keeps command text when Slack rejects a recognized command", async () => {
    let cleared = false;
    const succeeded = await submitComposerPayload({
      files: [],
      isSlashAttempt: true,
      onSuccess: () => {
        cleared = true;
      },
      runCommand: () => Promise.resolve({ handled: true, succeeded: false }),
      sendMessage: () => Promise.resolve(),
      uploadFiles: () => Promise.resolve(),
    });
    expect(succeeded).toBe(false);
    expect(cleared).toBe(false);
  });
});
