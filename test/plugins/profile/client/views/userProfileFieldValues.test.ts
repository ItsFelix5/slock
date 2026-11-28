import { describe, expect, test } from "bun:test";
import type { ProfileFieldDef } from "@slock/types";
import {
  isCustomFieldDef,
  mergeMissingProfileFieldValues,
} from "../../../../../packages/plugins/src/profile/client/views/userProfileFieldValues";

const def = (id: string, label: string, fieldName?: string): ProfileFieldDef => ({
  fieldName,
  id,
  label,
});

describe("isCustomFieldDef", () => {
  test.each([
    [def("Xf1", "Title"), false],
    [def("Xf2", "  start DATE "), false],
    [def("Xf3", "Anything", "start_date"), false],
    [def("Xf4", "Favorite color"), true],
    [def("Xf5", "Titles"), true],
    [def("Xf6", ""), true],
  ])("%j is custom: %p", (field, expected) => {
    expect(isCustomFieldDef(field)).toBe(expected);
  });
});

describe("mergeMissingProfileFieldValues", () => {
  const definitions = [def("A", "a"), def("B", "b"), def("C", "c")];

  test("fills only missing ids and keeps typed drafts", () => {
    const current = { A: "typed" };
    const next = mergeMissingProfileFieldValues(current, definitions, [
      { id: "A", value: "server" },
      { id: "B", value: "from server" },
    ]);
    expect(next).toEqual({ A: "typed", B: "from server", C: "" });
    expect(current).toEqual({ A: "typed" });
  });

  test("keeps an intentionally cleared draft instead of refilling it", () => {
    expect(
      mergeMissingProfileFieldValues({ A: "" }, definitions, [{ id: "A", value: "x" }]).A,
    ).toBe("");
  });

  test("returns the same object when nothing is missing", () => {
    const current = { A: "1", B: "2", C: "3" };
    expect(mergeMissingProfileFieldValues(current, definitions, [])).toBe(current);
  });

  test("ignores values without a definition", () => {
    expect(mergeMissingProfileFieldValues({}, [def("A", "a")], [{ id: "Z", value: "x" }])).toEqual({
      A: "",
    });
  });
});
