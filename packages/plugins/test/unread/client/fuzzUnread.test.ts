import { describe, expect, test } from "bun:test";
import { replayFuzz, runFuzz } from "../../fuzz/fuzzRun";
import { type Action, convergeSuite, healSuite } from "./fuzzUnreadSuite";

const at = (
  kind: "incoming" | "read" | "readElsewhere",
  channel: number,
  mention = false,
): Action => ({
  channel,
  kind,
  mention,
});

describe("unread fuzz", () => {
  test("counts converge to the server once settled", () => runFuzz(convergeSuite));

  test("a refresh repairs lost events and failed requests", () => runFuzz(healSuite));
});

describe("unread fuzz regressions", () => {
  test("seed 8: a counts snapshot taken before a read elsewhere does not undo it", () =>
    replayFuzz<Action>(convergeSuite, 8, [
      at("readElsewhere", 0),
      at("readElsewhere", 1),
      at("incoming", 1, true),
      { kind: "refresh" },
      at("readElsewhere", 1),
    ]));

  test("seed 147: a refresh never joins a counts request that started earlier", () =>
    replayFuzz<Action>(convergeSuite, 147, [
      at("incoming", 0),
      at("incoming", 1),
      { kind: "refresh" },
      at("read", 1),
      at("readElsewhere", 0),
      at("readElsewhere", 0, true),
      { kind: "refresh" },
      at("incoming", 2),
      at("readElsewhere", 1),
      at("incoming", 1),
      at("read", 0),
      { kind: "refresh" },
      at("incoming", 0),
      at("incoming", 2),
    ]));

  test("seed 29: a refresh clears mentions the server no longer has", () =>
    replayFuzz<Action>(healSuite, 29, [
      at("incoming", 0, true),
      at("read", 1),
      at("incoming", 0, true),
      at("readElsewhere", 0),
    ]));

  test("replay reports the seed on failure", async () => {
    const broken = { ...convergeSuite, run: async () => Promise.reject(new Error("boom")) };
    await expect(replayFuzz<Action>(broken, 5, [])).rejects.toThrow("seed 5");
  });
});
