import { describe, expect, test } from "bun:test";
import { forAll, int, pick, text } from "@slock/core/testing";
import { ch, stamp } from "@slock/slack/testing";
import {
  createSlackPermalinkOpener,
  navigateToSlackPermalink,
  parseSlackPermalink,
  type SlackPermalinkTarget,
} from "../../../../src/message-links/client/api/slackPermalink";

const target: SlackPermalinkTarget = {
  channelId: ch("C0123ABCD"),
  messageTs: stamp("1700000000.123456"),
  threadTs: stamp("1700000000.123456"),
};

describe("parseSlackPermalink", () => {
  const cases: [string, string, SlackPermalinkTarget | null][] = [
    ["workspace archive", "https://team.slack.com/archives/C0123ABCD/p1700000000123456", target],
    ["trailing slash", "https://team.slack.com/archives/C0123ABCD/p1700000000123456/", target],
    ["bare slack.com", "https://slack.com/archives/C0123ABCD/p1700000000123456", target],
    ["uppercase host", "https://TEAM.Slack.com/archives/C0123ABCD/p1700000000123456", target],
    [
      "thread reply",
      "https://team.slack.com/archives/C0123ABCD/p1700000005000100?thread_ts=1700000000.123456&cid=C0123ABCD",
      {
        channelId: ch("C0123ABCD"),
        messageTs: stamp("1700000005.000100"),
        threadTs: stamp("1700000000.123456"),
      },
    ],
    [
      "cid only",
      "https://team.slack.com/archives/C0123ABCD/p1700000000123456?cid=C0123ABCD",
      target,
    ],
    [
      "dm",
      "https://team.slack.com/archives/D0123ABCD/p1700000000123456",
      { ...target, channelId: ch("D0123ABCD") },
    ],
    [
      "garbage thread_ts falls back to the message",
      "https://team.slack.com/archives/C0123ABCD/p1700000000123456?thread_ts=abc",
      target,
    ],
    [
      "empty thread_ts",
      "https://team.slack.com/archives/C0123ABCD/p1700000000123456?thread_ts=",
      target,
    ],
    ["http", "http://team.slack.com/archives/C0123ABCD/p1700000000123456", null],
    ["other host", "https://example.com/archives/C0123ABCD/p1700000000123456", null],
    ["lookalike host", "https://notslack.com/archives/C0123ABCD/p1700000000123456", null],
    ["suffix lookalike", "https://slack.com.evil.io/archives/C0123ABCD/p1700000000123456", null],
    ["lowercase channel", "https://team.slack.com/archives/general/p1700000000123456", null],
    ["too few digits", "https://team.slack.com/archives/C0123ABCD/p123456", null],
    ["canvas", "https://team.slack.com/docs/T0123/F0123ABCD", null],
    ["file", "https://team.slack.com/files/U0123/F0123/name.png", null],
    ["channel archive without message", "https://team.slack.com/archives/C0123ABCD", null],
    ["extra path", "https://team.slack.com/archives/C0123ABCD/p1700000000123456/extra", null],
    ["not a url", "p1700000000123456", null],
    ["empty", "", null],
  ];

  test.each(cases)("%s", (_name, href, expected) => {
    expect(parseSlackPermalink(href)).toEqual(expected);
  });

  test("never throws on garbage", () => {
    forAll(
      (random) => text(random, "h:/.%slack archives?=&p0123456789ABCDXYZ#", 60),
      (href) => {
        const parsed = parseSlackPermalink(href);
        if (parsed) expect(parsed.messageTs).toMatch(/^\d+\.\d{6}$/);
      },
    );
  });

  test("round trips generated message timestamps", () => {
    forAll(
      (random) => ({
        channelId: `C0${text(random, "ABCDEFGHJKLMNP0123456789", 8)}`,
        micros: int(random, 0, 999999),
        seconds: int(random, 1_000_000_000, 2_000_000_000),
        subdomain: pick(random, ["team", "a-b", "x1"]),
      }),
      ({ channelId, micros, seconds, subdomain }) => {
        const digits = `${seconds}${String(micros).padStart(6, "0")}`;
        const parsed = parseSlackPermalink(
          `https://${subdomain}.slack.com/archives/${channelId}/p${digits}`,
        );
        expect(parsed?.channelId).toBe(ch(channelId));
        expect(parsed?.messageTs).toBe(stamp(`${seconds}.${String(micros).padStart(6, "0")}`));
        expect(parsed?.threadTs).toBe(parsed?.messageTs);
      },
    );
  });
});

describe("navigateToSlackPermalink", () => {
  function run(next: SlackPermalinkTarget) {
    const calls: unknown[][] = [];
    navigateToSlackPermalink(next, {
      openChannelMessage: (...args) => calls.push(["message", ...args]),
      openChannelPeek: (...args) => calls.push(["peek", ...args]),
    });
    return calls;
  }

  test("opens a top level message in the channel", () => {
    expect(run(target)).toEqual([["message", ch("C0123ABCD"), stamp("1700000000.123456")]]);
  });

  test("opens a reply as a peek highlighting the reply", () => {
    const reply = { ...target, messageTs: stamp("1700000005.000100") };
    expect(run(reply)).toEqual([["peek", ch("C0123ABCD"), stamp("1700000000.123456"), stamp("1700000005.000100")]]);
  });
});

describe("createSlackPermalinkOpener", () => {
  function setup(probe: (t: SlackPermalinkTarget) => Promise<boolean>) {
    const events: string[] = [];
    const opener = createSlackPermalinkOpener({
      navigate: (t) => events.push(`navigate ${t.messageTs}`),
      onError: () => events.push("error"),
      onUnavailable: () => events.push("unavailable"),
      probe,
    });
    return { events, opener };
  }

  test("navigates when the probe succeeds", async () => {
    const { events, opener } = setup(() => Promise.resolve(true));
    await opener.open(target);
    expect(events).toEqual(["navigate 1700000000.123456"]);
  });

  test("reports unavailable messages", async () => {
    const { events, opener } = setup(() => Promise.resolve(false));
    await opener.open(target);
    expect(events).toEqual(["unavailable"]);
  });

  test("reports probe failures", async () => {
    const { events, opener } = setup(() => Promise.reject(new Error("boom")));
    await opener.open(target);
    expect(events).toEqual(["error"]);
  });

  test("only the latest open navigates", async () => {
    const gates: (() => void)[] = [];
    const { events, opener } = setup(
      () => new Promise<boolean>((resolve) => gates.push(() => resolve(true))),
    );
    const first = opener.open(target);
    const second = opener.open({ ...target, messageTs: stamp("1700000009.000001") });
    for (const release of gates) release();
    await Promise.all([first, second]);
    expect(events).toEqual(["navigate 1700000009.000001"]);
  });

  test("invalidate drops a pending open", async () => {
    let release = () => {};
    const { events, opener } = setup(
      () => new Promise<boolean>((resolve) => (release = () => resolve(true))),
    );
    const pending = opener.open(target);
    opener.invalidate();
    release();
    await pending;
    expect(events).toEqual([]);
  });

  test("a stale failure is ignored", async () => {
    let fail = () => {};
    const { events, opener } = setup(
      () => new Promise<boolean>((_, reject) => (fail = () => reject(new Error("late")))),
    );
    const pending = opener.open(target);
    opener.invalidate();
    fail();
    await pending;
    expect(events).toEqual([]);
  });
});
