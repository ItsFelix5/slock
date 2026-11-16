import { describe, expect, test } from "bun:test";
import { parseAction, parseCommand } from "../src/api";

describe("parseAction", () => {
  test("keeps known fields and drops the rest", () => {
    expect(parseAction({ action: "post", evil: 1, text: "hi", threadTs: "1.2" })).toEqual({
      action: "post",
      text: "hi",
      threadTs: "1.2",
    });
  });

  test("rejects wrong types, unknown actions and missing timestamps", () => {
    expect(parseAction({ action: "post", text: 5 })).toBeUndefined();
    expect(parseAction({ action: "post", unfurl: [1] })).toBeUndefined();
    expect(parseAction({ action: "nuke" })).toBeUndefined();
    expect(parseAction({ action: "edit", text: "x" })).toBeUndefined();
    expect(parseAction({ action: "delete" })).toBeUndefined();
    expect(parseAction("post")).toBeUndefined();
  });

  test("attaches files to posts and edits but not deletes", () => {
    const files = [new File(["a"], "a.txt")];
    expect(parseAction({ action: "post", text: "x" }, files)).toMatchObject({ files });
    expect(parseAction({ action: "edit", text: "x", ts: "1.1" }, files)).toMatchObject({ files });
    expect(parseAction({ action: "delete", ts: "1.1" }, files)).not.toHaveProperty("files");
  });
});

describe("parseCommand", () => {
  test("understands the token word and json actions", () => {
    expect(parseCommand(" token ")).toBe("token");
    expect(parseCommand('{"action":"delete","ts":"1.1"}')).toEqual({ action: "delete", ts: "1.1" });
    expect(parseCommand("hello")).toBeUndefined();
    expect(parseCommand('{"action":"nuke"}')).toBeUndefined();
  });
});
