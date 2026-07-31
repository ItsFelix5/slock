// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import type { User } from "@slock/slack-api";
import { createActivitySlice } from "../activity";

const CURRENT_USER: User = {
  avatarColor: "#123456",
  id: "U1",
  name: "Test user",
  presence: "active",
};

const deps = {
  clearChannelUnread: () => {},
  currentUser: () => CURRENT_USER,
  lastReadByChannel: {},
  setLastReadByChannel: () => {},
  syncChannelRead: () => Promise.resolve(true),
};

describe("createActivitySlice loading", () => {
  test("distinguishes a failed load from an empty feed and recovers on retry", async () => {
    let shouldFail = true;
    const activity = createActivitySlice(deps, {
      fetchActivityFeedEntries: () =>
        shouldFail ? Promise.reject(new Error("offline")) : Promise.resolve([]),
    });
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await activity.ensureActivityLoaded();
    } finally {
      console.error = originalConsoleError;
    }

    expect(activity.activityLoaded()).toBe(false);
    expect(activity.activityLoadError()).toBe(true);
    expect(activity.activityLoading()).toBe(false);

    shouldFail = false;
    await activity.ensureActivityLoaded();
    expect(activity.activityLoaded()).toBe(true);
    expect(activity.activityLoadError()).toBe(false);
  });

  test("deduplicates overlapping refreshes", async () => {
    let resolveRequest: (entries: []) => void = () => {};
    const request = new Promise<[]>((resolve) => {
      resolveRequest = resolve;
    });
    let calls = 0;
    const activity = createActivitySlice(deps, {
      fetchActivityFeedEntries: () => {
        calls++;
        return request;
      },
    });

    const first = activity.ensureActivityLoaded();
    const second = activity.ensureActivityLoaded();
    expect(calls).toBe(1);
    expect(activity.activityLoading()).toBe(true);

    resolveRequest([]);
    await Promise.all([first, second]);
    expect(activity.activityLoading()).toBe(false);
  });
});
