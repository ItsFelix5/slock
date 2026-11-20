import { describe, expect, test } from "bun:test";
import { forAll, pick, text } from "@slock/core/testing";
import { parseChannelId, parseTs } from "@slock/slack";
import type { ChannelId } from "@slock/types";
import { SLASH_COMMAND_RE } from "../../../src/slash-commands/client/api";
import { handleSlashCommand } from "../../../src/slash-commands/client/slashCommand";

const C1 = parseChannelId("C1");

function harness(result: () => Promise<string | null>) {
  const runs: [string, string, string][] = [];
  const flashes: [string, string][] = [];
  const deps = {
    flashError: (key: string, message: string) => flashes.push([key, message]),
    run: (channelId: ChannelId, command: string, body: string) => {
      runs.push([channelId, command, body]);
      return result();
    },
  };
  return { deps, flashes, runs };
}

describe("SLASH_COMMAND_RE", () => {
  test.each([
    ["/me waves", "me", "waves"],
    ["/remind me to eat", "remind", "me to eat"],
    ["/shrug", "shrug", ""],
    ["/shrug   ", "shrug", ""],
    ["/topic line one\nline two", "topic", "line one\nline two"],
    ["/me   spaced", "me", "spaced"],
  ])("parses %j", (input, command, rest) => {
    const match = SLASH_COMMAND_RE.exec(input);
    expect([match?.[1], match?.[2]]).toEqual([command, rest]);
  });

  test.each(["", "hello", " /me", "//comment", "/", "/ me", "a /me"])("rejects %j", (input) => {
    expect(SLASH_COMMAND_RE.test(input)).toBe(false);
  });

  test("any non-space command word with any argument parses back", () => {
    forAll(
      (random) => ({
        argument: text(random, "abc 😀\nx.y", 30),
        command: `a${text(random, "abcxyz-_😀", 8)}`,
        gap: pick(random, [" ", "  ", "\n"]),
      }),
      ({ command, gap, argument }) => {
        const match = SLASH_COMMAND_RE.exec(`/${command}${gap}${argument}`);
        expect(match?.[1]).toBe(command);
        expect(match?.[2]).toBe(argument.trimStart());
      },
    );
  });

  test("never throws on garbage", () => {
    forAll(
      (random) => text(random, "/ \n\t😀a\u0000\ud83d", 40),
      (input) => {
        SLASH_COMMAND_RE.exec(input);
      },
    );
  });
});

describe("handleSlashCommand", () => {
  test("plain text is not handled and never hits the network", async () => {
    const { deps, runs } = harness(async () => null);
    expect(await handleSlashCommand(deps, C1, undefined, "hello")).toEqual({
      handled: false,
      succeeded: false,
    });
    expect(runs).toEqual([]);
  });

  test("runs the command with its argument", async () => {
    const { deps, runs, flashes } = harness(async () => null);
    expect(await handleSlashCommand(deps, C1, undefined, "/remind me tomorrow")).toEqual({
      handled: true,
      succeeded: true,
    });
    expect(runs).toEqual([["C1", "/remind", "me tomorrow"]]);
    expect(flashes).toEqual([]);
  });

  test("a Slack error is flashed under the channel key", async () => {
    const { deps, flashes } = harness(async () => "The app didn't respond.");
    const result = await handleSlashCommand(deps, C1, undefined, "/foo");
    expect(result).toEqual({ handled: true, succeeded: false });
    expect(flashes).toEqual([["composer:C1", "The app didn't respond."]]);
  });

  test("thread commands flash under the thread key", async () => {
    const { deps, flashes } = harness(async () => "nope");
    await handleSlashCommand(deps, C1, parseTs("9.9"), "/foo");
    expect(flashes).toEqual([["composer:9.9", "nope"]]);
  });

  test("a network failure is flashed instead of rejecting", async () => {
    const { deps, flashes } = harness(() => Promise.reject(new Error("offline")));
    const result = await handleSlashCommand(deps, C1, undefined, "/foo");
    expect(result).toEqual({ handled: true, succeeded: false });
    expect(flashes).toEqual([["composer:C1", "offline"]]);
  });
});
