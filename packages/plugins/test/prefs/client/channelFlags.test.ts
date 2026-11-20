import { describe, expect, test } from "bun:test";
import { ch } from "@slock/slack/testing";
import { createRoot, flush } from "solid-js";
import { createChannelFlags } from "../../../src/prefs/client/channelFlags";

function setup() {
  return createRoot(() => createChannelFlags());
}

const a = ch("C1");
const b = ch("C2");

describe("channel flags", () => {
  test("begin flips the flag and marks it pending until settled", () => {
    const flags = setup();
    flags.begin(a, true);
    flush();
    expect(flags.isEnabled(a)).toBe(true);
    expect(flags.isPending(a)).toBe(true);
    flags.settle(a);
    flush();
    expect(flags.isPending(a)).toBe(false);
    expect(flags.isEnabled(a)).toBe(true);
  });

  test("enabledIdsWith predicts the next list without waiting for a flush", () => {
    const flags = setup();
    flags.sync([a], { respectPending: false });
    flush();
    expect(flags.enabledIdsWith(b, true)).toEqual([a, b]);
    expect(flags.enabledIdsWith(a, false)).toEqual([]);
  });

  test("sync leaves pending channels alone when asked to", () => {
    const flags = setup();
    flags.begin(a, true);
    flush();
    flags.sync([b], { respectPending: true });
    flush();
    expect(flags.isEnabled(a)).toBe(true);
    expect(flags.isEnabled(b)).toBe(true);
  });

  test("sync overrides pending channels after a failed write", () => {
    const flags = setup();
    flags.begin(a, true);
    flush();
    flags.settleAll();
    flags.sync([], { respectPending: false });
    flush();
    expect(flags.isEnabled(a)).toBe(false);
    expect(flags.isPending(a)).toBe(false);
  });
});
