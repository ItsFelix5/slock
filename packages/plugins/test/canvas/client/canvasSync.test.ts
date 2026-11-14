import { afterEach, describe, expect, test } from "bun:test";
import { createSyncHarness, type SyncHarness, settle } from "./syncHarness";

let h: SyncHarness;

afterEach(() => h.sync.dispose());

describe("saving typed edits", () => {
  test("typing in a line saves only that line", async () => {
    h = createSyncHarness(["one", "two", "three"]);
    const lines = h.lines().map((l) => ({ ...l }));
    const second = lines[1];
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
    await h.sync.retry();
    expect(h.sync.status()).toBe("saved");
    expect(h.serverTexts()).toEqual(["one!"]);
  });

  test("a conflict stops saving and typing does not hide it", async () => {
    h = createSyncHarness(["one"]);
    h.failNext("unknown_anchor");
    h.setLines([{ sid: h.lines()[0]?.sid ?? null, text: "one!" }]);
    await h.sync.flush();
    expect(h.sync.status()).toBe("conflict");
    h.setLines([{ sid: h.lines()[0]?.sid ?? null, text: "one!!" }]);
    expect(h.sync.status()).toBe("conflict");
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
    await h.sync.retry();
    expect(h.serverTexts()).toEqual(["AB"]);
  });
});
