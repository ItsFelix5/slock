import { afterEach, describe, expect, test } from "bun:test";

process.env.TZ = "America/Los_Angeles";

import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv } from "@slock/core/testing";
import { querySuggestions } from "../../../../src/search/client/views/querySuggestions";

let host: ReturnType<typeof createHost> | undefined;

function boot(start: number) {
  const env = createFakeEnv(1, start);
  host = createHost({ env, reactive: solidReactive });
  setHost(host);
}

afterEach(() => host?.stop());

const values = (query: string) =>
  querySuggestions(query, query.length, [], []).map((suggestion) => suggestion.value);

describe("date modifiers use the local calendar day", () => {
  test("after: offsets count from the local day, not UTC", () => {
    boot(Date.UTC(2026, 0, 15, 2, 0));
    expect(values("after:")).toEqual(["after:2026-01-14", "after:2026-01-13", "after:2026-01-07"]);
  });

  test("during: names the current and previous month in local time", () => {
    boot(new Date(2026, 2, 31, 12).getTime());
    expect(values("during:")).toEqual(["during:march", "during:february", "during:2026"]);
  });
});
