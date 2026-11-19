import { describe, expect, test } from "bun:test";
import { mapCanvasVersion, mapDraft, mapSavedItem, mapSearchResult } from "../../src/map/api";
import { ch, stamp, uid } from "../../src/testing";

describe("api mappers", () => {
  test("mapDraft brands the ids", () => {
    expect(
      mapDraft({ blocks: [], channelId: "C1", clientMsgId: "m", id: "Dr1", threadTs: "1.1" }),
    ).toEqual({
      blocks: [],
      channelId: ch("C1"),
      clientMsgId: "m",
      id: "Dr1",
      lastUpdatedTs: undefined,
      threadTs: stamp("1.1"),
    });
  });

  test("mapSearchResult keeps the rest of the result", () => {
    expect(
      mapSearchResult({
        channelId: "C1",
        channelName: "general",
        text: "hi",
        ts: "1.1",
        userId: "U1",
      }),
    ).toMatchObject({ channelId: ch("C1"), text: "hi", ts: stamp("1.1"), userId: uid("U1") });
  });

  test("mapSavedItem and mapCanvasVersion", () => {
    expect(mapSavedItem({ channelId: "C1", ts: "2" })).toEqual({
      channelId: ch("C1"),
      ts: stamp("2"),
    });
    expect(
      mapCanvasVersion({ authorId: "U1", createdMs: 1, sequence: 2, versionId: "v" }).authorId,
    ).toBe(uid("U1"));
  });

  test("rejects an id that is not shaped like Slack's", () => {
    expect(() => mapSavedItem({ channelId: "nope", ts: "2" })).toThrow(/not a channel id/);
  });
});
