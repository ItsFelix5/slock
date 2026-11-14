import { describe, expect, test } from "bun:test";

process.env.TZ = "Europe/Brussels";

import { forAll, pick, text } from "@slock/core/testing";
import { dateSuggest } from "../../../../src/dates/client/lib/dateSuggest";
import { parseDateQuery } from "../../../../src/dates/client/lib/parseDateQuery";

const SLACK_DATE_TAG = /^<!date\^\d+\^[^^|>]+\|[^|>]+>$/;

function search(query: string) {
  const result = dateSuggest.search(query);
  if (!Array.isArray(result)) throw new Error("date suggestions are synchronous");
  return result;
}

describe("dateSuggest", () => {
  test("trigger is !", () => {
    expect(dateSuggest.trigger).toBe("!");
  });

  test("unparsable queries give no suggestions", () => {
    expect(search("nonsense")).toEqual([]);
    expect(search("")).toEqual([]);
  });

  test("a day without a time offers date formats and relative time only", () => {
    const suggestions = search("tomorrow");
    const inserts = suggestions.map((suggestion) => suggestion.insert);
    expect(inserts).toHaveLength(4);
    expect(inserts.some((insert) => insert.includes("{time"))).toBe(false);
    expect(inserts.at(-1)).toContain("^{ago}|");
  });

  test("a day with a time appends the time and offers time-only formats", () => {
    const parsed = parseDateQuery("tomorrow_9am");
    const inserts = search("tomorrow_9am").map((suggestion) => suggestion.insert);
    expect(inserts).toHaveLength(6);
    expect(inserts[0]).toStartWith(`<!date^${parsed?.ts}^{date_pretty} at {time}|`);
    expect(inserts).toContain(`<!date^${parsed?.ts}^{time}|${inserts[0]?.split("|")[1]}`);
    expect(inserts.some((insert) => insert.includes("^{time_secs}|"))).toBe(true);
  });

  test("relative variants carry the plain format as their alternate", () => {
    const [first] = search("tomorrow_9am");
    expect(first?.insert).toContain("{date_pretty} at {time}");
    expect(first?.alternate?.insert).toContain("^{date} at {time}|");
  });

  test("ids are unique within one search", () => {
    forAll(
      (random) =>
        `${pick(random, ["today", "tomorrow", "mon", "dec25", "+2h"])}${pick(random, ["", "_9am", "_1730"])}`,
      (query) => {
        const ids = search(query).flatMap((suggestion) =>
          suggestion.alternate ? [suggestion.id, suggestion.alternate.id] : [suggestion.id],
        );
        expect(new Set(ids).size).toBe(ids.length);
      },
    );
  });

  test("every insert is a well formed Slack date tag", () => {
    forAll(
      (random) => text(random, "tomorrw9am_+0h1dwy", 10),
      (query) => {
        for (const suggestion of search(query)) {
          expect(suggestion.insert).toMatch(SLACK_DATE_TAG);
          if (suggestion.alternate) expect(suggestion.alternate.insert).toMatch(SLACK_DATE_TAG);
        }
      },
      500,
    );
  });
});
