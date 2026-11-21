import { describe, expect, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import { createViewSession } from "../../../src/view-modals/client/viewSession";

const session = () => createRoot(createViewSession);

const typeInto = (s: ReturnType<typeof session>, viewId: string, blockId: string) =>
  s.stateFor(viewId).record(blockId, "a", { type: "plain_text_input", value: "x" });

describe("view session", () => {
  test("a view keeps one state between lookups and views do not share it", () => {
    const s = session();
    expect(s.stateFor("V1")).toBe(s.stateFor("V1"));
    expect(s.stateFor("V1")).not.toBe(s.stateFor("V2"));
  });

  test("editing a block clears only that block's error in that view", () => {
    const s = session();
    s.setErrorsFor("V1", { b1: "bad", b2: "worse" });
    s.setErrorsFor("V2", { b1: "other view" });
    typeInto(s, "V1", "b1");
    flush();
    expect(s.errorsFor("V1")).toEqual({ b2: "worse" });
    expect(s.errorsFor("V2")).toEqual({ b1: "other view" });
  });

  test("a view counts as touched after its first edit and not before", () => {
    const s = session();
    expect(s.touched("V1")).toBe(false);
    typeInto(s, "V1", "b1");
    flush();
    expect(s.touched("V1")).toBe(true);
    expect(s.touched("V2")).toBe(false);
  });

  test("forget drops state, errors and touched for views that closed", () => {
    const s = session();
    const kept = s.stateFor("V1");
    const dropped = s.stateFor("V2");
    s.setErrorsFor("V1", { b: "e1" });
    s.setErrorsFor("V2", { b: "e2" });
    typeInto(s, "V1", "x");
    typeInto(s, "V2", "x");
    flush();
    s.forget(["V1"]);
    flush();
    expect(s.stateFor("V1")).toBe(kept);
    expect(s.stateFor("V2")).not.toBe(dropped);
    expect(s.errorsFor("V2")).toEqual({});
    expect(s.touched("V2")).toBe(false);
    expect(s.errorsFor("V1")).toEqual({ b: "e1" });
    expect(s.touched("V1")).toBe(true);
  });
});
