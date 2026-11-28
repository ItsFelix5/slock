import { expect, spyOn, test } from "bun:test";
import { logUnknown } from "../../packages/core/src/util/logUnknown";

test("logs each unknown thing once, by type", () => {
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  logUnknown("block", { text: "private", type: "hologram" });
  logUnknown("block", "hologram");
  expect(warn.mock.calls).toEqual([["unknown block: hologram"]]);
  warn.mockRestore();
});
