import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createReadSync } from "../../../../src/unread/client/store/readSync";

type Flash = [string, string, string | undefined];

function setup(failWith?: () => unknown) {
  const channelWrites: [string, string][] = [];
  const threadWrites: [string, string, string][] = [];
  const flashes: Flash[] = [];
  const outcome = () => {
    const error = failWith?.();
    return error === undefined ? Promise.resolve() : Promise.reject(error);
  };
  const readSync = createReadSync(
    {
      markChannelRead: (channelId, ts) => {
        channelWrites.push([channelId, ts]);
        return outcome();
      },
      markThreadRead: (channelId, threadTs, ts) => {
        threadWrites.push([channelId, threadTs, ts]);
        return outcome();
      },
    },
    (key, message, kind) => flashes.push([key, message, kind]),
  );
  return { channelWrites, flashes, readSync, threadWrites };
}

let errors: ReturnType<typeof spyOn>;
beforeEach(() => {
  errors = spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => errors.mockRestore());

describe("thread read errors", () => {
  test.each([
    "message_not_found",
    "channel_not_found",
  ])("%s counts as synced and stays quiet", async (code) => {
    const { flashes, readSync, threadWrites } = setup(() => new Error(code));
    expect(await readSync.setThreadRead("C1", "1.1", "2.2")).toBe(true);
    expect(threadWrites).toEqual([["C1", "1.1", "2.2"]]);
    expect(flashes).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });

  test("a gone thread is not written again for the same or an older reply", async () => {
    const { readSync, threadWrites } = setup(() => new Error("message_not_found"));
    await readSync.setThreadRead("C1", "1.1", "5.5");
    expect(await readSync.syncThreadRead("C1", "1.1", "5.5")).toBe(true);
    expect(await readSync.syncThreadRead("C1", "1.1", "3.3")).toBe(true);
    expect(threadWrites).toHaveLength(1);
  });

  test("any other error fails once with a flash on the thread", async () => {
    const { flashes, readSync } = setup(() => new Error("ratelimited"));
    expect(await readSync.setThreadRead("C1", "1.1", "2.2")).toBe(false);
    expect(flashes).toEqual([["1.1", "Couldn't sync thread read state.", "error"]]);
  });

  test("a non Error rejection is a failure, not a gone thread", async () => {
    const { flashes, readSync } = setup(() => "message_not_found");
    expect(await readSync.setThreadRead("C1", "1.1", "2.2")).toBe(false);
    expect(flashes).toHaveLength(1);
  });
});

describe("channel read errors", () => {
  test("channel_not_found counts as synced and stays quiet", async () => {
    const { flashes, readSync } = setup(() => new Error("channel_not_found"));
    expect(await readSync.setChannelRead("C1", "2.2")).toBe(true);
    expect(flashes).toEqual([]);
  });

  test("message_not_found is only forgiven for threads", async () => {
    const { flashes, readSync } = setup(() => new Error("message_not_found"));
    expect(await readSync.setChannelRead("C1", "2.2")).toBe(false);
    expect(flashes).toEqual([["C1", "Couldn't sync read state.", "error"]]);
  });

  test("a failed channel write can be retried", async () => {
    let failing = true;
    const { channelWrites, readSync } = setup(() => (failing ? new Error("boom") : undefined));
    expect(await readSync.syncChannelRead("C1", "2.2")).toBe(false);
    failing = false;
    expect(await readSync.syncChannelRead("C1", "2.2")).toBe(true);
    expect(channelWrites).toHaveLength(2);
  });
});

describe("isStaleReadEcho", () => {
  test("an older cursor we sent is stale once a newer one went out", () => {
    const { readSync } = setup();
    readSync.syncChannelRead("C1", "1.1");
    readSync.syncChannelRead("C1", "2.2");
    expect(readSync.isStaleReadEcho("C1", "1.1")).toBe(true);
    expect(readSync.isStaleReadEcho("C1", "2.2")).toBe(false);
  });

  test("cursors we never sent and other channels are not stale", () => {
    const { readSync } = setup();
    readSync.syncChannelRead("C1", "1.1");
    readSync.syncChannelRead("C1", "2.2");
    expect(readSync.isStaleReadEcho("C1", "9.9")).toBe(false);
    expect(readSync.isStaleReadEcho("C2", "1.1")).toBe(false);
  });

  test("thread reads do not count as channel echoes", async () => {
    const { readSync } = setup();
    await readSync.setThreadRead("C1", "1.1", "2.2");
    expect(readSync.isStaleReadEcho("C1", "2.2")).toBe(false);
  });
});
