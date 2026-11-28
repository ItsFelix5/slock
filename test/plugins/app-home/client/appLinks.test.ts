import { expect, test } from "bun:test";
import { parseAppLink } from "../../../../packages/plugins/src/app-home/client/appLinks";

test("reads the app and tab from a slack app link", () => {
  expect(parseAppLink("slack://app?id=A0BF7AGMH8X&tab=home")).toEqual({
    appId: "A0BF7AGMH8X",
    tab: "home",
  });
  expect(parseAppLink("slack://app?team=T1&id=A1")).toEqual({ appId: "A1", tab: null });
});

test("ignores other links", () => {
  expect(parseAppLink("slack://channel?team=T1&id=C1")).toBeUndefined();
  expect(parseAppLink("slack://app?tab=home")).toBeUndefined();
  expect(parseAppLink("https://slack.com/app?id=A1")).toBeUndefined();
});
