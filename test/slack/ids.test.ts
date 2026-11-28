import { describe, expect, test } from "bun:test";
import {
  compareTs,
  ifPresent,
  isChannelId,
  isTs,
  maxTs,
  parseChannelId,
  parseFileId,
  parseTeamId,
  parseTs,
  parseUserId,
} from "../../packages/slack/src/ids";
import { forAll, int, type Random, text } from "../support/core";

describe("id parsers", () => {
  test.each([["C1"], ["G0123ABCD"], ["D1234567890"]])("accepts channel id %s", (raw) => {
    expect<string>(parseChannelId(raw)).toBe(raw);
  });

  test.each([[""], ["c1"], ["U1"], ["C"], ["C-1"], ["C1 "]])("rejects channel id %p", (raw) => {
    expect(isChannelId(raw)).toBe(false);
    expect(() => parseChannelId(raw)).toThrow(/not a channel id/);
  });

  test("users include workspace users and bots", () => {
    for (const raw of ["U1", "W1", "B0BU242DJHM", "USLACKBOT"])
      expect<string>(parseUserId(raw)).toBe(raw);
    expect(() => parseUserId("C1")).toThrow();
  });

  test("team ids are workspace ids, not enterprise ids", () => {
    expect<string>(parseTeamId("T0123")).toBe("T0123");
    expect(() => parseTeamId("E0123")).toThrow();
  });

  test("file ids start with F", () => {
    expect<string>(parseFileId("F0123ABCD")).toBe("F0123ABCD");
    expect(() => parseFileId("C0123ABCD")).toThrow();
  });

  test("a rejected id fails as a deterministic Slack error", () => {
    expect(() => parseChannelId("nope")).toThrow(
      expect.objectContaining({ code: "invalid_wire_id", kind: "deterministic" }),
    );
  });

  test("ifPresent skips empty input", () => {
    expect(ifPresent(parseChannelId, undefined)).toBeUndefined();
    expect(ifPresent(parseChannelId, "")).toBeUndefined();
    expect<string | undefined>(ifPresent(parseChannelId, "C1")).toBe("C1");
  });
});

describe("ts", () => {
  test.each([["1"], ["1.1"], ["1700000000.000100"]])("accepts %s", (raw) => {
    expect(isTs(raw)).toBe(true);
  });

  test.each([[""], ["."], ["1."], [".5"], ["nope"], ["1.2.3"]])("rejects %p", (raw) => {
    expect(isTs(raw)).toBe(false);
  });

  test("compares numerically, not as strings", () => {
    expect(compareTs(parseTs("9.0"), parseTs("10.0"))).toBe(-1);
    expect(compareTs(parseTs("10.5"), parseTs("10.25"))).toBe(1);
    expect(compareTs(parseTs("1700000000.000100"), parseTs("1700000000.000099"))).toBe(1);
    expect(compareTs(parseTs("5"), parseTs("5.000000"))).toBe(0);
  });

  test("compares at microsecond precision beyond float range", () => {
    expect(compareTs(parseTs("9999999999.999999"), parseTs("9999999999.999998"))).toBe(1);
  });

  test("maxTs picks the newest", () => {
    expect(maxTs(parseTs("2"), parseTs("10"), parseTs("9.5"))).toBe(parseTs("10"));
    expect(maxTs(parseTs("3"))).toBe(parseTs("3"));
  });

  test("compare is antisymmetric", () => {
    const tsOf = (random: Random) =>
      parseTs(`${int(random, 0, 3e9)}.${text(random, "0123456789", 6)}0`);
    forAll(
      (random) => ({ a: tsOf(random), b: tsOf(random) }),
      ({ a, b }) => {
        expect(compareTs(a, b) + compareTs(b, a)).toBe(0);
      },
    );
  });
});
