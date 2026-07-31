// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import type { UserPrefs } from "@slock/slack-api";
import { setSectionSidebarPreference } from "./sectionSidebarPrefs";

function prefs(sectionSidebar: UserPrefs["sectionSidebar"]): UserPrefs {
  return {
    channelFrecency: {},
    channelTabs: {},
    desktopNotificationsEnabled: false,
    emojiUse: {},
    globalNotifications: {
      channelsInActivity: true,
      desktop: "mentions",
      desktopPushEnabled: false,
      keywords: [],
      mpdmDesktop: "mentions",
      noTextInNotifications: false,
      pushIdleWait: 0,
      pushShowPreview: true,
      threadsEverything: false,
    },
    highlightWords: [],
    mutedChannels: [],
    notifyAllChannels: [],
    searchHistory: [],
    sectionSidebar,
    sectionSort: {},
  };
}

describe("setSectionSidebarPreference", () => {
  test("a failed update can restore its key without erasing a concurrent change", () => {
    const before = prefs({ first: "hid", second: "active" });
    const optimistic = setSectionSidebarPreference(before, "first", "all");
    const afterConcurrentSuccess = setSectionSidebarPreference(optimistic, "second", "all");

    const rolledBack = setSectionSidebarPreference(afterConcurrentSuccess, "first", "hid");

    expect(rolledBack.sectionSidebar).toEqual({ first: "hid", second: "all" });
  });

  test("restoring an absent value removes only that section key", () => {
    const current = prefs({ createdDuringRequest: "active", failed: "all" });

    const rolledBack = setSectionSidebarPreference(current, "failed", undefined);

    expect(rolledBack.sectionSidebar).toEqual({ createdDuringRequest: "active" });
  });
});
