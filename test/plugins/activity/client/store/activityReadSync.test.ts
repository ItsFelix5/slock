import { describe, expect, test } from "bun:test";
import { flush } from "solid-js";
import { createActivityReadSync } from "../../../../../packages/plugins/src/activity/client/store/activityReadSync";
import { ch, stamp } from "../../../../support/slack";

function controlled() {
  const calls: { channelId: string; ts: string; settle: (value: boolean | Error) => void }[] = [];
  const sync = createActivityReadSync(
    (channelId, ts) =>
      new Promise<boolean>((resolve, reject) => {
        calls.push({
          channelId,
          settle: (value) => (value instanceof Error ? reject(value) : resolve(value)),
          ts,
        });
      }),
  );
  return { calls, sync };
}

describe("createActivityReadSync", () => {
  test("tracks pending while a request runs", async () => {
    const { calls, sync } = controlled();
    const result = sync.request(ch("C1"), stamp("1.1"));
    flush();
    expect(sync.isPending()).toBe(true);
    calls[0]?.settle(true);
    expect(await result).toBe(true);
    flush();
    expect(sync.isPending()).toBe(false);
    expect(sync.error()).toBe(false);
  });

  test("a failed sync raises the error and retry resends the failed ts", async () => {
    const { calls, sync } = controlled();
    const failed = sync.request(ch("C1"), stamp("1.1"));
    calls[0]?.settle(false);
    expect(await failed).toBe(false);
    expect(sync.error()).toBe(true);
    const retried = sync.retry();
    expect(calls[1]).toMatchObject({ channelId: "C1", ts: "1.1" });
    calls[1]?.settle(true);
    await retried;
    expect(sync.error()).toBe(false);
  });

  test("a rejected sync counts as failed instead of throwing", async () => {
    const { calls, sync } = controlled();
    const result = sync.request(ch("C1"), stamp("1.1"));
    calls[0]?.settle(new Error("network"));
    expect(await result).toBe(false);
    expect(sync.error()).toBe(true);
    expect(sync.isPending()).toBe(false);
  });

  test("only the newest request per channel decides the outcome", async () => {
    const { calls, sync } = controlled();
    const older = sync.request(ch("C1"), stamp("1.1"));
    const newer = sync.request(ch("C1"), stamp("2.2"));
    calls[1]?.settle(true);
    expect(await newer).toBe(true);
    expect(sync.isPending()).toBe(true);
    calls[0]?.settle(false);
    expect(await older).toBe(false);
    expect(sync.error()).toBe(false);
    expect(sync.isPending()).toBe(false);
  });

  test("channels fail and recover independently", async () => {
    const { calls, sync } = controlled();
    const a = sync.request(ch("C1"), stamp("1.1"));
    const b = sync.request(ch("C2"), stamp("1.1"));
    calls[0]?.settle(false);
    calls[1]?.settle(true);
    await Promise.all([a, b]);
    expect(sync.error()).toBe(true);
    const retried = sync.retry();
    expect(calls.slice(2).map((call) => call.channelId)).toEqual(["C1"]);
    calls[2]?.settle(true);
    await retried;
    expect(sync.error()).toBe(false);
  });
});
