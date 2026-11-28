import { describe, expect, test } from "bun:test";
import {
  initialSession,
  reduceSession,
  type SessionState,
} from "../../../../packages/plugins/src/drafts/client/draftSession";

const saved = {
  activeId: undefined,
  clientMsgId: "cm",
  currentKey: "C1",
  draftKey: "C1",
  generation: 0,
  id: "D1",
  kind: "saved",
  knownId: undefined,
} as const;

const deleted = {
  activeId: "D1",
  draftKey: "C1",
  generation: 0,
  kind: "deleted",
  startId: "D1",
  typedEmpty: false,
} as const;

describe("saves finishing late", () => {
  test("a save from an older session is ignored", () => {
    const state: SessionState = { ...initialSession, generation: 3 };
    const stale = reduceSession(state, { ...saved, generation: 2 });
    expect(stale.effects).toEqual([]);
    expect(stale.state).toBe(state);
  });

  test("a save for another key or active draft is ignored", () => {
    expect(reduceSession(initialSession, { ...saved, currentKey: "C2" }).effects).toEqual([]);
    expect(reduceSession(initialSession, { ...saved, activeId: "D0" }).effects).toEqual([]);
  });

  test("a current save adopts the id without reloading it", () => {
    const step = reduceSession(initialSession, saved);
    expect(step.effects).toEqual([{ id: "D1", kind: "setActiveDraftId" }]);
    expect(step.state).toMatchObject({ clientMsgId: "cm", loadedFor: "C1::D1" });
  });

  test("a stale delete is ignored", () => {
    expect(reduceSession(initialSession, { ...deleted, generation: 1 }).effects).toEqual([]);
    expect(reduceSession(initialSession, { ...deleted, activeId: "D2" }).effects).toEqual([]);
  });

  test("a current delete keeps typed text and clears the id", () => {
    const step = reduceSession(initialSession, deleted);
    expect(step.effects).toEqual([{ id: undefined, kind: "setActiveDraftId" }]);
    expect(step.state.loadedFor).toBe("C1::new");
    const empty = reduceSession(initialSession, { ...deleted, typedEmpty: true });
    expect(empty.state.loadedFor).toBeUndefined();
  });
});

describe("session events", () => {
  test("sent bumps the generation and parks the key on a new draft", () => {
    const state: SessionState = { ...initialSession, clientMsgId: "cm", generation: 1 };
    const step = reduceSession(state, { draftKey: "C1", kind: "sent" });
    expect(step.effects).toEqual([{ id: undefined, kind: "setActiveDraftId" }]);
    expect(step.state).toMatchObject({
      clientMsgId: undefined,
      generation: 2,
      loadedFor: "C1::new",
      persistedFor: "C1::new",
    });
  });

  test("sent without a key only bumps the generation", () => {
    const step = reduceSession(initialSession, { draftKey: undefined, kind: "sent" });
    expect(step.effects).toEqual([]);
    expect(step.state.generation).toBe(1);
  });

  test("startNew and switch change the id and client message id", () => {
    const start = reduceSession({ ...initialSession, clientMsgId: "cm" }, { kind: "startNew" });
    expect(start.state).toMatchObject({ clientMsgId: undefined, generation: 1 });
    const switched = reduceSession(initialSession, {
      clientMsgId: "cm2",
      id: "D2",
      kind: "switch",
    });
    expect(switched.effects).toEqual([{ id: "D2", kind: "setActiveDraftId" }]);
    expect(switched.state.clientMsgId).toBe("cm2");
  });

  test("claiming keeps an existing client message id", () => {
    const claimed = reduceSession(initialSession, { kind: "claimClientMsgId", mintedId: "a" });
    const again = reduceSession(claimed.state, { kind: "claimClientMsgId", mintedId: "b" });
    expect(again.state.clientMsgId).toBe("a");
  });
});
