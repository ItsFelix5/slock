import { describe, expect, test } from "bun:test";
import {
  loadMoreReason,
  MAX_AUTO_TOP_UP_ATTEMPTS,
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
