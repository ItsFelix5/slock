import { describe, expect, test } from "bun:test";
import {
  initialSession,
  reduceSession,
} from "../../../../packages/plugins/src/drafts/client/draftSession";
import { stamp } from "../../../support/slack";
import { blocks } from "./composerHarness";
import { entry, kinds, sync } from "./draftSessionFacts";

describe("default draft for a key", () => {
  test("waits for the store and adopts the newest draft", () => {
    const entries = [
      entry("D1", { lastUpdatedTs: stamp("100.1") }),
      entry("D2", { lastUpdatedTs: stamp("200.1") }),
    ];
    const early = sync(initialSession, { entries, storeReady: false });
    expect(early.effects).toEqual([]);
    expect(early.state.defaultForKey).toBeUndefined();

    const ready = sync(early.state, { entries });
    expect(ready.effects).toContainEqual({ id: "D2", kind: "setActiveDraftId" });
    expect(ready.state).toMatchObject({ clientMsgId: "cm-D2", defaultForKey: "C1" });
  });

  test("switching keys re-adopts, and an empty key clears the active draft", () => {
    const first = sync(initialSession, { entries: [entry("D1")] });
    const switched = sync(first.state, { activeDraftId: "D1", draftKey: "C2", entries: [] });
    expect(switched.effects).toContainEqual({ id: undefined, kind: "setActiveDraftId" });
    expect(switched.state).toMatchObject({ clientMsgId: undefined, defaultForKey: "C2" });
  });

  test("adopts only once per key", () => {
    const first = sync(initialSession, { entries: [entry("D1")] });
    const again = sync(first.state, { activeDraftId: "D1", entries: [entry("D1"), entry("D2")] });
    expect(kinds(again.effects)).not.toContain("setActiveDraftId");
    expect(again.state.clientMsgId).toBe("cm-D1");
  });
});

describe("orphaned draft id", () => {
  const withOrphan = { activeDraftId: "gone", entries: [entry("D1"), entry("gone")] };
  const afterRemoval = { activeDraftId: "gone", entries: [entry("D1")] };
  const loaded = () => sync(initialSession, withOrphan).state;

  test("starts a new session and clears the id", () => {
    const before = loaded();
    const step = sync(before, afterRemoval);
    expect(step.effects).toEqual([{ id: undefined, kind: "setActiveDraftId" }]);
    expect(step.state.generation).toBe(before.generation + 1);
    expect(step.state.clientMsgId).toBeUndefined();
  });

  test("typed text is parked on the new draft instead of reloaded", () => {
    const text = { blocks: blocks("keep me"), empty: false };
    const before = sync(initialSession, { ...withOrphan, ...text }).state;
    const step = sync(before, { ...afterRemoval, ...text });
    expect(step.state).toMatchObject({ loadedFor: "C1::new", persistedFor: "C1::new" });
    expect(kinds(step.effects)).not.toContain("loadIntoEditor");
  });

  test("an empty editor keeps the loaded token so the new draft loads", () => {
    const step = sync(loaded(), afterRemoval);
    expect(step.state.loadedFor).toBe("C1::gone");
    const next = sync(step.state, { activeDraftId: undefined, entries: [entry("D1")] });
    expect(next.effects).toContainEqual({ blocks: [], kind: "loadIntoEditor" });
  });

  test("is not orphaned before the store is ready", () => {
    const step = sync(initialSession, { ...afterRemoval, storeReady: false });
    expect(step.state.generation).toBe(0);
    expect(step.effects).toEqual([]);
  });
});

describe("loading into the editor", () => {
  const entries = [entry("D1"), entry("D2")];

  test("loads the active draft once per token", () => {
    const first = sync(initialSession, { activeDraftId: "D1", entries });
    expect(first.effects).toContainEqual({ blocks: blocks("text D1"), kind: "loadIntoEditor" });

    const typing = sync(first.state, {
      activeDraftId: "D1",
      blocks: blocks("x"),
      empty: false,
      entries,
    });
    expect(kinds(typing.effects)).not.toContain("loadIntoEditor");
  });

  test("loads again when the id changes", () => {
    const first = sync(initialSession, { activeDraftId: "D1", entries });
    const next = sync(first.state, { activeDraftId: "D2", entries });
    expect(next.effects).toContainEqual({ blocks: blocks("text D2"), kind: "loadIntoEditor" });
  });

  test("falls back to unsaved text, then to an empty editor", () => {
    const unsaved = blocks("unsaved");
    expect(sync(initialSession, { unsaved }).effects).toContainEqual({
      blocks: unsaved,
      kind: "loadIntoEditor",
    });
    expect(sync(initialSession).effects).toContainEqual({ blocks: [], kind: "loadIntoEditor" });
  });

  test("does nothing until the editor and store are ready", () => {
    for (const over of [{ editorReady: false }, { storeReady: false }]) {
      expect(kinds(sync(initialSession, over).effects)).not.toContain("loadIntoEditor");
    }
  });

  test("a list change alone does not reload", () => {
    const first = sync(initialSession, { activeDraftId: "D1", entries });
    const changed = sync(first.state, { activeDraftId: "D1", entries: [entry("D1")] });
    expect(kinds(changed.effects)).not.toContain("loadIntoEditor");
  });
});

describe("tokens set by other events", () => {
  test("a draft that was just saved is not reloaded over the editor", () => {
    const { state } = reduceSession(initialSession, {
      activeId: undefined,
      clientMsgId: "cm",
      currentKey: "C1",
      draftKey: "C1",
      generation: 0,
      id: "D1",
      kind: "saved",
      knownId: undefined,
    });
    const step = sync(state, { activeDraftId: "D1", entries: [entry("D1")] });
    expect(kinds(step.effects)).not.toContain("loadIntoEditor");
  });

  test("the new draft after a send is not reloaded over typed text", () => {
    const { state } = reduceSession(initialSession, { draftKey: "C1", kind: "sent" });
    const step = sync(state, { blocks: blocks("typed"), empty: false });
    expect(kinds(step.effects)).not.toContain("loadIntoEditor");
  });
});
