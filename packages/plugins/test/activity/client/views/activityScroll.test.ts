import { describe, expect, test } from "bun:test";
import {
  loadMoreReason,
  MAX_AUTO_TOP_UP_ATTEMPTS,
  topUpStep,
} from "../../../../src/activity/client/views/activityScroll";

const metrics = (scrollHeight: number, scrollTop: number) => ({
  clientHeight: 100,
  scrollHeight,
  scrollTop,
});

describe("loadMoreReason", () => {
  test("tops up while the list does not fill the viewport, up to the attempt cap", () => {
    expect(loadMoreReason(metrics(100, 0), 0)).toBe("top-up");
    expect(loadMoreReason(metrics(100, 0), MAX_AUTO_TOP_UP_ATTEMPTS - 1)).toBe("top-up");
    expect(loadMoreReason(metrics(100, 0), MAX_AUTO_TOP_UP_ATTEMPTS)).toBeUndefined();
  });

  test("loads more within one and a half viewports of the bottom", () => {
    expect(loadMoreReason(metrics(1000, 750), 0)).toBe("near-bottom");
    expect(loadMoreReason(metrics(1000, 749), 0)).toBeUndefined();
  });

  test("scrolling near the bottom is not limited by the top-up cap", () => {
    expect(loadMoreReason(metrics(1000, 900), MAX_AUTO_TOP_UP_ATTEMPTS)).toBe("near-bottom");
  });
});

describe("topUpStep", () => {
  const short = metrics(100, 0);

  test("counts top-up attempts per key and stops at the cap", () => {
    let { state } = topUpStep(undefined, "a", short);
    expect(state).toEqual({ attempts: 1, key: "a" });
    for (let i = 1; i < MAX_AUTO_TOP_UP_ATTEMPTS; i++) {
      const step = topUpStep(state, "a", short);
      expect(step.load).toBe(true);
      ({ state } = step);
    }
    const capped = topUpStep(state, "a", short);
    expect(capped.load).toBe(false);
    expect(capped.state.attempts).toBe(MAX_AUTO_TOP_UP_ATTEMPTS);
  });

  test("a new key resets the attempts", () => {
    const capped = { attempts: MAX_AUTO_TOP_UP_ATTEMPTS, key: "a" };
    expect(topUpStep(capped, "b", short)).toEqual({ load: true, state: { attempts: 1, key: "b" } });
  });

  test("near-bottom loads do not spend attempts", () => {
    const state = { attempts: 3, key: "a" };
    expect(topUpStep(state, "a", metrics(1000, 900))).toEqual({ load: true, state });
    expect(topUpStep(state, "a", metrics(1000, 0))).toEqual({ load: false, state });
  });

  test("without a container nothing loads but the key is recorded", () => {
    expect(topUpStep({ attempts: 5, key: "a" }, "b", undefined)).toEqual({
      load: false,
      state: { attempts: 0, key: "b" },
    });
  });
});
