import { describe, expect, test } from "bun:test";
import { newerSpanHint } from "../../../../../packages/plugins/src/messages/client/store/history/historyWindow";
import { stamp } from "../../../../support/slack";
import { message, slackTs } from "../messageFixture";

const at = (...seconds: number[]) => seconds.map((s) => message(stamp(slackTs(1_700_000_000 + s))));

describe("newerSpanHint", () => {
  test("is undefined without a density to measure", () => {
    expect(newerSpanHint(undefined)).toBeUndefined();
    expect(newerSpanHint(at(0))).toBeUndefined();
  });

  test("aims for about 30 messages at the observed pace", () => {
    expect(newerSpanHint(at(0, 100, 200))).toBe(3000);
  });

  test("stays between a minute and a week", () => {
    expect(newerSpanHint(at(0, 1))).toBe(60);
    expect(newerSpanHint(at(0, 10_000_000))).toBe(7 * 86_400);
  });
});
