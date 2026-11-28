import { afterEach, describe, expect, test } from "bun:test";
import { editOf } from "../protocol/canvasSimulator";
import { createSyncHarness, type EditorLine, type SyncHarness, settle } from "./syncHarness";

let h: SyncHarness;

afterEach(() => h.sync.detach());

describe("saving typed edits", () => {
  test("renaming an empty canvas adds no paragraph to it", async () => {
    h = createSyncHarness([]);
    h.setLines([{ sid: null, text: "" }]);
    h.setTitle("Renamed");
    await h.quiesce();
    expect(h.serverTitle()).toBe("Renamed");
    expect(h.serverTexts()).toEqual([]);
  });

  test("typing in a line saves only that line", async () => {
    h = createSyncHarness(["one", "two", "three"]);
    const lines = h.lines().map((l) => ({ ...l }));
    const [, second] = lines;
    if (second) second.text = "two!";
    h.setLines(lines);
    await h.quiesce();
    expect(h.serverTexts()).toEqual(["one", "two!", "three"]);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]?.upserts).toHaveLength(1);
  });

  test("pressing enter in the middle of a line keeps the id on one half", async () => {
    h = createSyncHarness(["hello world"]);
    const [line] = h.lines();
    h.setLines([
      { sid: line?.sid ?? null, text: "hello" },
      { sid: line?.sid ?? null, text: " world" },
    ]);
    await h.quiesce();
    expect(h.serverTexts()).toEqual(["hello", " world"]);
    expect(new Set(h.serverIds()).size).toBe(2);
    expect(new Set(h.lines().map((l) => l.sid)).size).toBe(2);
  });
});

describe("edits while a save is in flight", () => {
  test("typing during a save lands in a second save", async () => {
    h = createSyncHarness(["one"]);
    const release = h.hold();
    h.setLines([{ sid: h.lines()[0]?.sid ?? null, text: "one A" }]);
    const first = h.sync.flush();
    await settle();
    h.setLines([{ sid: h.lines()[0]?.sid ?? null, text: "one AB" }]);
    release();
    await first;
    await h.quiesce();
    expect(h.serverTexts()).toEqual(["one AB"]);
    expect(h.sync.status()).toBe("saved");
  });

  test("a line created and deleted during a save does not reach the server", async () => {
    h = createSyncHarness(["one"]);
    const release = h.hold();
    const keep = h.lines()[0]?.sid ?? null;
    h.setLines([{ sid: keep, text: "one!" }]);
    const first = h.sync.flush();
    await settle();
    h.setLines([
      { sid: keep, text: "one!" },
      { sid: null, text: "temp" },
    ]);
    h.setLines([{ sid: keep, text: "one!" }]);
    release();
    await first;
    await h.quiesce();
    expect(h.serverTexts()).toEqual(["one!"]);
  });

  test("a line deleted during the save that created it is deleted afterwards", async () => {
    h = createSyncHarness(["one"]);
    const keep = h.lines()[0]?.sid ?? null;
    const release = h.hold();
    h.setLines([
      { sid: keep, text: "one" },
      { sid: null, text: "temp" },
    ]);
    const first = h.sync.flush();
    await settle();
    h.setLines([{ sid: keep, text: "one" }]);
    release();
    await first;
    await h.quiesce();
    expect(h.serverTexts()).toEqual(["one"]);
  });
});

describe("failures", () => {
  test("a network error keeps the edit and the retry sends it", async () => {
    h = createSyncHarness(["one"]);
    h.failNext("network");
    h.setLines([{ sid: h.lines()[0]?.sid ?? null, text: "one!" }]);
    await h.sync.flush();
    expect(h.sync.status()).toBe("error");
    expect(h.serverTexts()).toEqual(["one"]);
    await h.sync.flush();
    expect(h.sync.status()).toBe("saved");
    expect(h.serverTexts()).toEqual(["one!"]);
  });

  test("a conflict merges the newer copy and saves again", async () => {
    h = createSyncHarness(["one", "two"]);
    const [first, second] = h.serverIds();
    h.server.apply(editOf({ deleted: [second ?? ""] }));
    h.failNext("unknown_anchor");
    h.setLines([
      { sid: first ?? null, text: "one" },
      { sid: second ?? null, text: "two!" },
    ]);
    await h.sync.flush();
    await h.quiesce();
    expect(h.serverTexts()).toEqual(["one", "two!"]);
    expect(h.errors).toEqual([]);
  });

  test("an edit made while the failing save was in flight is still sent", async () => {
    h = createSyncHarness(["one"]);
    const sid = h.lines()[0]?.sid ?? null;
    h.failNext("network");
    const release = h.hold();
    h.setLines([{ sid, text: "A" }]);
    const first = h.sync.flush();
    await settle();
    h.setLines([{ sid, text: "AB" }]);
    release();
    await first;
    await h.sync.flush();
    expect(h.serverTexts()).toEqual(["AB"]);
  });
});

describe("an editor that cannot hold some content", () => {
  const withoutSecret = (shown: EditorLine[]) =>
    shown.map((line) => ({ ...line, text: line.text.replace("secret", "") }));

  test("text lost while loading is not saved over", async () => {
    h = createSyncHarness(["a secret", "two"]);
    h.loseOnShow(withoutSecret);
    h.sync.adoptLoaded();
    const lines = h.lines();
    h.setLines([...lines.slice(0, 1), { sid: lines[1]?.sid ?? null, text: "two!" }]);
    await h.quiesce();
    expect(h.serverTexts()).toEqual(["a secret", "two!"]);
    expect(h.sent[0]?.upserts).toHaveLength(1);
  });

  test("a line lost while loading is not deleted", async () => {
    h = createSyncHarness(["one", "two"]);
    h.loseOnShow((shown) => shown.filter((line) => line.text !== "one"));
    h.sync.adoptLoaded();
    h.sync.markDirty();
    await h.quiesce();
    expect(h.serverTexts()).toEqual(["one", "two"]);
    expect(h.sent).toEqual([]);
  });

  test("text lost while showing a remote change is not saved over", async () => {
    h = createSyncHarness(["one"]);
    h.loseOnShow(withoutSecret);
    h.sync.adoptLoaded();
    const [sid] = h.serverIds();
    h.server.apply(
      editOf({
        upserts: [
          {
            after: null,
            node: {
              checked: false,
              frames: [],
              html: "a secret",
              id: sid ?? "",
              indent: 0,
              kind: "paragraph",
              level: 0,
            },
          },
        ],
      }),
    );
    h.sync.receive(h.copy());
    await h.quiesce();
    expect(h.serverTexts()).toEqual(["a secret"]);
    expect(h.sent).toEqual([]);
  });
});

describe("closing the editor", () => {
  test("what was typed during a save is still sent", async () => {
    h = createSyncHarness(["one"]);
    const sid = h.lines()[0]?.sid ?? null;
    const release = h.hold();
    h.setLines([{ sid, text: "one A" }]);
    void h.sync.flush();
    await settle();
    h.setLines([{ sid, text: "one AB" }]);
    const closing = h.sync.detach();
    release();
    await closing;
    expect(h.serverTexts()).toEqual(["one AB"]);
  });
});
