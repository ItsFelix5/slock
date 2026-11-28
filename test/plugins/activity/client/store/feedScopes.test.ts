import { describe, expect, test } from "bun:test";
import { flush } from "solid-js";
import {
  createFeedScopes,
  hasMoreAfter,
  MAIN_SCOPE,
  scopeKey,
} from "../../../../../packages/plugins/src/activity/client/store/feedScopes";
import { inRoot } from "../../../../support/core";

describe("scopeKey", () => {
  test("unscoped requests share the main scope", () => {
    expect(scopeKey()).toBe(MAIN_SCOPE);
    expect(scopeKey(undefined, false)).toBe(MAIN_SCOPE);
    expect(scopeKey("")).toBe(MAIN_SCOPE);
  });

  test("types and unread-only combine without colliding", () => {
    const keys = [scopeKey("a"), scopeKey("a", true), scopeKey(undefined, true), scopeKey("b")];
    expect(new Set(keys).size).toBe(4);
  });
});

describe("hasMoreAfter", () => {
  test("needs a cursor", () => {
    expect(hasMoreAfter({ entries: [1] }, false)).toBe(false);
    expect(hasMoreAfter({ entries: [1], nextCursor: "c" }, false)).toBe(true);
  });

  test("an empty older page ends pagination, an empty newest page does not", () => {
    expect(hasMoreAfter({ entries: [], nextCursor: "c" }, false)).toBe(false);
    expect(hasMoreAfter({ entries: [], nextCursor: "c" }, true)).toBe(true);
  });
});

describe("createFeedScopes", () => {
  test("is loaded once the main scope recorded a page, and scopes are independent", () => {
    const { value: scopes, dispose } = inRoot(createFeedScopes);
    expect(scopes.loaded()).toBe(false);
    expect(scopes.hasMore("x")).toBe(true);
    scopes.record("x", { entries: [1] });
    flush();
    expect(scopes.loaded()).toBe(false);
    expect(scopes.hasMore("x")).toBe(false);
    scopes.record(MAIN_SCOPE, { entries: [1], nextCursor: "c" }, true);
    flush();
    expect(scopes.loaded()).toBe(true);
    expect(scopes.cursor(MAIN_SCOPE)).toBe("c");
    expect(scopes.cursor("x")).toBeUndefined();
    dispose();
  });
});
