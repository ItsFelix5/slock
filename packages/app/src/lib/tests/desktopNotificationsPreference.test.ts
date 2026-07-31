// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { resolveDesktopNotificationsEnabled } from "../../../../slack-api/src/api/endpoints/preferences/desktopNotifications";

describe("resolveDesktopNotificationsEnabled", () => {
  test("prefers the app-specific persisted toggle", () => {
    expect(resolveDesktopNotificationsEnabled("off", true)).toBe(false);
    expect(resolveDesktopNotificationsEnabled("on", false)).toBe(true);
  });

  test("uses the Slack global value until a Slock toggle has been saved", () => {
    expect(resolveDesktopNotificationsEnabled(undefined, false)).toBe(false);
    expect(resolveDesktopNotificationsEnabled("unexpected", true)).toBe(true);
  });
});
