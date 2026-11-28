import { describe, expect, test } from "bun:test";
import { initialSession } from "../../../../packages/plugins/src/drafts/client/draftSession";
import { ch } from "../../../support/slack";
import { blocks } from "./composerHarness";
import { entry, kinds, sync } from "./draftSessionFacts";

const typed = blocks("hello");
const loaded = () => sync(initialSession, { blocks: typed, empty: false }).state;

describe("saving", () => {
  test("the first sync after a load only flushes", () => {
    const step = sync(initialSession, { blocks: typed, empty: false });
    expect(kinds(step.effects)).toContain("flushPendingSave");
    expect(kinds(step.effects)).not.toContain("scheduleSave");
  });

  test("an edit schedules a save and keeps its client message id", () => {
    const edited = blocks("hello world");
    const step = sync(loaded(), { blocks: edited, empty: false });
    expect(step.effects).toEqual([
      {
        blocks: edited,
        channelId: ch("C1"),
        clientMsgId: "minted",
        generation: 0,
        id: undefined,
        kind: "scheduleSave",
        threadTs: undefined,
      },
    ]);
    const next = sync(step.state, { blocks: blocks("more"), empty: false, mintedId: "other" });
    expect(next.effects).toContainEqual(expect.objectContaining({ clientMsgId: "minted" }));
  });

  test("a draft with text is mirrored into the store before the save", () => {
    const entries = [entry("D1")];
    const first = sync(initialSession, { activeDraftId: "D1", entries });
    const edited = sync(first.state, {
      activeDraftId: "D1",
      blocks: blocks("more"),
      empty: false,
      entries,
    });
    expect(kinds(edited.effects)).toEqual(["upsertDraft", "scheduleSave"]);
    expect(edited.effects[0]).toMatchObject({
      entry: { blocks: blocks("more"), clientMsgId: "cm-D1", id: "D1" },
    });
  });

  test("emptying a draft removes it and never upserts", () => {
    const entries = [entry("D1")];
    const first = sync(initialSession, { activeDraftId: "D1", entries });
    const cleared = sync(first.state, {
      activeDraftId: "D1",
      blocks: blocks(" "),
      empty: true,
      entries,
    });
    expect(cleared.effects).toContainEqual({ draftKey: "C1", id: "D1", kind: "removeDraft" });
    expect(kinds(cleared.effects)).not.toContain("upsertDraft");
  });

  test("an empty editor with no draft only schedules", () => {
    const step = sync(loaded(), { blocks: [], empty: true });
    expect(kinds(step.effects)).toEqual(["scheduleSave"]);
  });

  test("nothing is saved when not ready or without a channel", () => {
    for (const over of [
      { editorReady: false },
      { storeReady: false },
      { channelId: undefined, draftKey: undefined },
    ]) {
      const step = sync(loaded(), { ...over, blocks: blocks("changed"), empty: false });
      expect(kinds(step.effects)).not.toContain("scheduleSave");
      expect(kinds(step.effects)).not.toContain("upsertDraft");
    }
  });
});

describe("duplicate inputs", () => {
  const edited = blocks("hi!");
  const first = () => sync(loaded(), { blocks: edited, empty: false });

  test("the same facts are not saved twice", () => {
    const step = first();
    const again = sync(step.state, { blocks: edited, empty: false, mintedId: "m2" });
    expect(again.effects).toEqual([]);
    expect(again.state).toEqual(step.state);
  });

  test("a list change alone neither reloads nor reschedules", () => {
    const again = sync(first().state, { blocks: edited, empty: false, entries: [entry("D9")] });
    expect(again.effects).toEqual([]);
  });

  test("losing and regaining readiness runs the persist step again", () => {
    const away = sync(first().state, { blocks: edited, empty: false, storeReady: false });
    const back = sync(away.state, { blocks: edited, empty: false });
    expect(kinds(back.effects)).toContain("scheduleSave");
  });
});
