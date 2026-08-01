import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveUnreadLandingIndex } from "./unreadLanding";

describe("unread landing", () => {
  test("lands at the bottom when the only unread message fits in the viewport", () => {
    assert.equal(
      resolveUnreadLandingIndex(9, 10, { unreadRowHeight: 120, viewportHeight: 600 }),
      -1,
    );
  });

  test("lands at the divider when the only unread message is taller than the viewport", () => {
    assert.equal(
      resolveUnreadLandingIndex(9, 10, { unreadRowHeight: 800, viewportHeight: 600 }),
      9,
    );
  });

  test("lands at the divider when multiple messages are unread", () => {
    assert.equal(
      resolveUnreadLandingIndex(7, 10, { unreadRowHeight: 120, viewportHeight: 600 }),
      7,
    );
  });
});
