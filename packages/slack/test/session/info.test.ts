import { describe, expect, test } from "bun:test";
import { forAll, int, pick, text } from "@slock/core/testing";
import type { AccountSummary, SessionInfo } from "@slock/types";
import {
  extractSlackSession,
  INFO_COOKIE,
  parseSessionInfo,
  sessionInfoCookie,
} from "../../src/session/info";

const account = (id: string): AccountSummary => ({
  domain: `${id}.slack.com`,
  id,
  name: id,
  teamId: null,
});

const encoded = (value: unknown) => encodeURIComponent(JSON.stringify(value));

describe("parseSessionInfo", () => {
  test("accepts an active account that exists", () => {
    const info: SessionInfo = { accounts: [account("a"), account("b")], id: "b" };
    expect(parseSessionInfo(encoded(info))).toEqual(info);
  });

  test("accepts no active account", () => {
    expect(parseSessionInfo(encoded({ accounts: [], id: null }))).toEqual({
      accounts: [],
      id: null,
    });
  });

  test.each([
    ["not json", "%7Bnope"],
    ["bad escape", "%E0%A4%A"],
    ["null", encoded(null)],
    ["array", encoded([])],
    ["missing id", encoded({ accounts: [] })],
    ["numeric id", encoded({ accounts: [], id: 1 })],
    ["accounts not an array", encoded({ accounts: {}, id: null })],
    ["active id not in accounts", encoded({ accounts: [account("a")], id: "z" })],
    ["null account entry", encoded({ accounts: [null], id: "a" })],
  ])("rejects %s", (_name, cookie) => {
    expect(parseSessionInfo(cookie)).toBeNull();
  });

  test("round trips through the cookie string", () => {
    forAll(
      (random) => {
        const ids = Array.from(
          { length: int(random, 0, 4) },
          (_, i) => `${text(random, "abc😀 ;=%", 4)}${i}`,
        );
        return { accounts: ids.map(account), id: ids.length ? pick(random, ids) : null };
      },
      (info) => {
        const header = sessionInfoCookie(info);
        const value = header.slice(`${INFO_COOKIE}=`.length, header.indexOf(";"));
        expect(parseSessionInfo(value)).toEqual(info);
      },
    );
  });
});

describe("sessionInfoCookie", () => {
  test("is strict, root scoped and long lived", () => {
    const header = sessionInfoCookie({ accounts: [], id: null });
    expect(header).toStartWith(`${INFO_COOKIE}=`);
    expect(header).toContain("SameSite=Strict");
    expect(header).toContain("Path=/");
    expect(header).toMatch(/Max-Age=\d+/);
  });
});

describe("extractSlackSession", () => {
  test("finds the d cookie among others", () => {
    expect(extractSlackSession("a=1; d=xoxd-abc%2Bdef; b=2")).toBe("xoxd-abc%2Bdef");
  });

  test.each([
    ["d=nope"],
    ["id=xoxd-abc"],
    ["a=1; b=2"],
    [""],
    ["d"],
    ["d=xoxd-a b"],
  ])("ignores %p", (header) => {
    expect(extractSlackSession(header)).toBeUndefined();
  });

  test("skips a bad d cookie and takes a later good one", () => {
    expect(extractSlackSession("d=bad; d=xoxd-good")).toBe("xoxd-good");
  });

  test("tolerates spaces around the name", () => {
    expect(extractSlackSession("  d =xoxd-1")).toBe("xoxd-1");
  });
});
