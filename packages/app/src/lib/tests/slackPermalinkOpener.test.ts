// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, mock, test } from "bun:test";
import { createSlackPermalinkOpener, type SlackPermalinkTarget } from "../slackPermalink";

const firstTarget: SlackPermalinkTarget = {
  channelId: "C123",
  messageTs: "1700000000.123456",
  threadTs: "1700000000.123456",
};

const secondTarget: SlackPermalinkTarget = {
  channelId: "C456",
  messageTs: "1700000001.123456",
  threadTs: "1700000001.123456",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

describe("createSlackPermalinkOpener", () => {
  test("only navigates for the latest completed probe", async () => {
    const first = deferred<boolean>();
    const navigate = mock(() => {});
    const opener = createSlackPermalinkOpener({
      navigate,
      onError: mock(() => {}),
      onUnavailable: mock(() => {}),
      probe: (target) => (target === firstTarget ? first.promise : Promise.resolve(true)),
    });

    const firstOpen = opener.open(firstTarget);
    await opener.open(secondTarget);
    first.resolve(true);
    await firstOpen;

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(secondTarget);
  });

  test("reports an unavailable current target without navigating", async () => {
    const navigate = mock(() => {});
    const onUnavailable = mock(() => {});
    const opener = createSlackPermalinkOpener({
      navigate,
      onError: mock(() => {}),
      onUnavailable,
      probe: async () => false,
    });

    await opener.open(firstTarget);

    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  test("reports a rejected current probe", async () => {
    const error = new Error("network down");
    const onError = mock(() => {});
    const opener = createSlackPermalinkOpener({
      navigate: mock(() => {}),
      onError,
      onUnavailable: mock(() => {}),
      probe: () => Promise.reject(error),
    });

    await opener.open(firstTarget);

    expect(onError).toHaveBeenCalledWith(error);
  });

  test("invalidate suppresses a pending probe result", async () => {
    const pending = deferred<boolean>();
    const navigate = mock(() => {});
    const opener = createSlackPermalinkOpener({
      navigate,
      onError: mock(() => {}),
      onUnavailable: mock(() => {}),
      probe: () => pending.promise,
    });

    const opening = opener.open(firstTarget);
    opener.invalidate();
    pending.resolve(true);
    await opening;

    expect(navigate).not.toHaveBeenCalled();
  });
});
