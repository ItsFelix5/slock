import { describe, expect, test } from "bun:test";
import {
  type FeedLoadInput,
  nextFeedLoad,
} from "../../../../../packages/plugins/src/messages/client/lib/feedLoadDecision";

const tall = { clientHeight: 600, scrollHeight: 6000, scrollTop: 3000 };
const short = { clientHeight: 600, scrollHeight: 300, scrollTop: 0 };

function input(patch: Partial<FeedLoadInput>): FeedLoadInput {
  return {
    availability: { canLoadNewer: false, canLoadOlder: true },
    direction: undefined,
    lastLoad: undefined,
    metrics: short,
    size: 3,
    sizeAtLayoutLoad: undefined,
    ...patch,
  };
}

describe("nextFeedLoad", () => {
  test("a scroll direction only loads when near that edge", () => {
    const near = { ...tall, scrollTop: 100 };
    expect(nextFeedLoad(input({ direction: "older", metrics: near }))).toBe("older");
    expect(nextFeedLoad(input({ direction: "older", metrics: tall }))).toBeUndefined();
  });

  test("a layout check is skipped while the size is unchanged since the last layout load", () => {
    expect(nextFeedLoad(input({ sizeAtLayoutLoad: 3 }))).toBeUndefined();
    expect(nextFeedLoad(input({ sizeAtLayoutLoad: 2 }))).toBe("older");
  });

  test("a layout check never flips to the edge opposite the last load", () => {
    const nearBottom = { ...tall, scrollTop: 5000 };
    const both = { canLoadNewer: true, canLoadOlder: false };
    expect(
      nextFeedLoad(input({ availability: both, lastLoad: "older", metrics: nearBottom })),
    ).toBeUndefined();
    expect(
      nextFeedLoad(input({ availability: both, lastLoad: "newer", metrics: nearBottom })),
    ).toBe("newer");
    expect(
      nextFeedLoad(input({ availability: both, lastLoad: undefined, metrics: nearBottom })),
    ).toBe("newer");
  });

  test("resting at the bottom loads newer even after an older load", () => {
    const bottom = { ...tall, scrollTop: 5400 };
    const both = { canLoadNewer: true, canLoadOlder: true };
    expect(nextFeedLoad(input({ availability: both, lastLoad: "older", metrics: bottom }))).toBe(
      "newer",
    );
  });

  test("a list shorter than the viewport falls back to filling it", () => {
    expect(nextFeedLoad(input({ lastLoad: "newer" }))).toBe("older");
    expect(nextFeedLoad(input({ availability: { canLoadNewer: true, canLoadOlder: false } }))).toBe(
      "newer",
    );
  });
});
