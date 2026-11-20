import { describe, expect, test } from "bun:test";
import { joinFormat, parseFormat } from "../../../src/dates/client/api/dateFormats";

describe("date formats", () => {
  test("parseFormat splits a combined token", () => {
    expect(parseFormat("{date_pretty} at {time_secs}")).toEqual({
      ago: false,
      date: "{date_pretty}",
      time: "{time_secs}",
    });
  });

  test("parseFormat recognises the relative token", () => {
    expect(parseFormat("{ago}")).toEqual({ ago: true, date: "", time: "" });
  });

  test("joinFormat round trips and drops empty parts", () => {
    expect(joinFormat(false, "{date}", "{time}")).toBe("{date} at {time}");
    expect(joinFormat(false, "", "{time}")).toBe("{time}");
    expect(joinFormat(true, "{date}", "{time}")).toBe("{ago}");
  });
});
