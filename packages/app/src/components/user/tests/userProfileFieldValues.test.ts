// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { mergeMissingProfileFieldValues } from "../userProfileFieldValues";

describe("mergeMissingProfileFieldValues", () => {
  test("seeds definitions that arrive after the profile opens", () => {
    expect(
      mergeMissingProfileFieldValues(
        {},
        [
          { id: "location", label: "Location" },
          { id: "team", label: "Team" },
        ],
        [{ id: "location", value: "Brussels" }],
      ),
    ).toEqual({ location: "Brussels", team: "" });
  });

  test("does not overwrite a value the user has already edited", () => {
    expect(
      mergeMissingProfileFieldValues(
        { location: "Ghent" },
        [{ id: "location", label: "Location" }],
        [{ id: "location", value: "Brussels" }],
      ),
    ).toEqual({ location: "Ghent" });
  });
});
