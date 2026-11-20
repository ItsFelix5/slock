import { describe, expect, test } from "bun:test";
import { systemEnv } from "@slock/core";
import { createActivityFeedRefreshScheduler } from "../../../../src/activity/client/store/activityFeedRefresh";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function setup(refreshMs = 0) {
  let loading = false;
  let refreshes = 0;
  const scheduler = createActivityFeedRefreshScheduler({
    delayMs: 5,
    env: systemEnv,
    isLoading: () => loading,
    refresh: async () => {
      refreshes++;
      if (refreshMs) await wait(refreshMs);
    },
  });
  return {
    refreshes: () => refreshes,
    scheduler,
    setLoading: (value: boolean) => {
      loading = value;
    },
  };
}

describe("createActivityFeedRefreshScheduler", () => {
  test("does nothing until requested", async () => {
    const { refreshes } = setup();
    await wait(15);
    expect(refreshes()).toBe(0);
  });

  test("coalesces a burst of requests into one refresh", async () => {
    const { refreshes, scheduler } = setup();
    for (let i = 0; i < 10; i++) scheduler.request();
    await wait(20);
    expect(refreshes()).toBe(1);
  });

  test("a request during a refresh triggers one more", async () => {
    const { refreshes, scheduler } = setup(15);
    scheduler.request();
    await wait(10);
    scheduler.request();
    scheduler.request();
    await wait(60);
    expect(refreshes()).toBe(2);
  });

  test("waits while another load is running", async () => {
    const { refreshes, scheduler, setLoading } = setup();
    setLoading(true);
    scheduler.request();
    await wait(20);
    expect(refreshes()).toBe(0);
    setLoading(false);
    await wait(20);
    expect(refreshes()).toBe(1);
  });

  test("cancel drops the pending refresh", async () => {
    const { refreshes, scheduler } = setup();
    scheduler.request();
    scheduler.cancel();
    await wait(20);
    expect(refreshes()).toBe(0);
  });
});
