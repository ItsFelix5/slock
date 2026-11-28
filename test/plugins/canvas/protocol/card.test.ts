import { describe, expect, test } from "bun:test";
import { parseChannelId, parseTs } from "@slock/slack";
import type { CanvasCard, CanvasNode } from "@slock/types";
import { readCanvas } from "../../../../packages/plugins/src/canvas/protocol/document.ts";
import {
  rawMessage,
  rawString,
  rawVarint,
} from "../../../../packages/plugins/src/canvas/protocol/sectionWrite.ts";
import { editOf, Server, sectionId } from "./canvasSimulator.ts";

const url = "https://example.slack.com/archives/C2/p1795864455000001";

function card(n: number, isMessage: boolean): CanvasCard {
  return {
    channelId: parseChannelId("C1"),
    frames: [],
    id: sectionId(n),
    isMessage,
    kind: "card",
    ownerId: "E1",
    ts: parseTs("1795864455.419899"),
    url,
  };
}

function slackSection(id: string, content: [number, ReturnType<typeof rawString>]) {
  return new Map([
    [1, [rawString(id)]],
    [8, [rawString("m")]],
    [9, [rawVarint(56)]],
    [10, [rawVarint(44)]],
    [12, [rawMessage(new Map([[content[0], [content[1]]]]))]],
  ]);
}

describe("canvas cards", () => {
  test("a link card as Slack writes it is read as a card", () => {
    const server = new Server();
    const ref = rawMessage(new Map([[1, [rawString("suo:E1/C1/1795864455.419899")]]]));
    const attachment = rawMessage(
      new Map([
        [1, [rawString(url)]],
        [2, [rawVarint(3)]],
        [3, [rawMessage(new Map([[3, [ref]]]))]],
        [6, [rawVarint(1)]],
        [8, [rawVarint(0)]],
      ]),
    );
    server.sections.set("card", slackSection("card", [50, attachment]));

    expect(server.nodes()).toEqual([{ ...card(1, true), id: "card" }]);
  });

  test("cards survive being written, moved and deleted", () => {
    const server = new Server();
    const nodes: CanvasNode[] = [card(1, true), card(2, false)];
    server.apply(
      editOf({
        upserts: nodes.map((node, i) => ({ after: nodes[i - 1]?.id ?? null, node })),
      }),
    );
    expect(server.nodes()).toEqual(nodes);

    server.apply(editOf({ upserts: [{ after: sectionId(2), node: card(1, true) }] }));
    expect(server.nodes()).toEqual([card(2, false), card(1, true)]);

    server.apply(editOf({ deleted: [sectionId(1)] }));
    expect(server.nodes()).toEqual([card(2, false)]);
  });

  test("an inline link chip carries its title and address", () => {
    const server = new Server();
    const link = rawMessage(
      new Map([
        [3, [rawString(url)]],
        [4, [rawString('sam: "hi"')]],
      ]),
    );
    server.sections.set(
      "chip",
      new Map([
        [1, [rawString("chip")]],
        [8, [rawString("m")]],
        [9, [rawVarint(62)]],
        [11, [rawVarint(1)]],
        [12, [rawMessage(new Map([[56, [link]]]))]],
      ]),
    );

    expect(readCanvas(server.loadData())?.embeds.get("chip")).toEqual({
      title: 'sam: "hi"',
      type: "link",
      url,
    });
  });
});
