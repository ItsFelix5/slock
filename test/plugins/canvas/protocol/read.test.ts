import { describe, expect, test } from "bun:test";
import { parseChannelId, parseFileId, parseUserId } from "@slock/slack";
import type { CanvasControl, CanvasNode } from "@slock/types";
import {
  readCanvas,
  readCanvasVersion,
} from "../../../../packages/plugins/src/canvas/protocol/document.ts";
import { forAll, int } from "../../../support/core";
import { editOf, meta, Server, sectionId } from "./canvasSimulator.ts";

function paragraph(n: number, html: string): CanvasNode {
  return {
    checked: false,
    frames: [],
    html,
    id: sectionId(n),
    indent: 0,
    kind: "paragraph",
    level: 0,
  };
}

function serverWith(...nodes: CanvasNode[]): Server {
  const server = new Server();
  server.apply(
    editOf({
      title: "Doc",
      upserts: nodes.map((node, i) => ({ after: nodes[i - 1]?.id ?? null, node })),
    }),
  );
  return server;
}

describe("readCanvas", () => {
  test("reads title, nodes and meta from a load payload", () => {
    const document = readCanvas(serverWith(paragraph(1, "hi"), paragraph(2, "there")).loadData());
    expect(document?.title).toBe("Doc");
    expect(document?.nodes.map((node) => node.id)).toEqual([sectionId(1), sectionId(2)]);
    expect(document?.meta).toEqual(meta);
  });

  test("an empty payload has no document", () => {
    expect(readCanvas(new Uint8Array())).toBeNull();
  });

  test("a document with no sections has empty nodes and title", () => {
    const document = readCanvas(new Server().loadData());
    expect(document).toMatchObject({ embeds: new Map(), fileIds: [], nodes: [], title: "" });
  });

  test("a line Slack sends without content is an empty line that can be typed into", () => {
    const server = serverWith(paragraph(1, "a"));
    server.sections.get(sectionId(1))?.delete(12);
    expect(readCanvas(server.loadData())?.nodes).toEqual([paragraph(1, "")]);
    server.apply(editOf({ upserts: [{ after: null, node: paragraph(1, "b") }] }));
    expect(server.nodes()).toEqual([paragraph(1, "b")]);
  });

  test("duplicate section ids read each node once", () => {
    const server = serverWith(paragraph(1, "a"));
    const original = server.sections.get(sectionId(1));
    if (!original) throw new Error("missing section");
    server.sections.set("dup", new Map(original));
    expect(readCanvas(server.loadData())?.nodes).toHaveLength(1);
  });

  test("file ids from images and file nodes are collected once", () => {
    const server = new Server();
    server.apply(
      editOf({
        upserts: [
          {
            after: null,
            node: {
              fileId: parseFileId("F1"),
              frames: [],
              id: sectionId(1),
              kind: "file",
              permalink: "p",
            },
          },
          {
            after: sectionId(1),
            node: {
              fileId: parseFileId("F1"),
              frames: [],
              id: sectionId(2),
              kind: "file",
              permalink: "p",
            },
          },
        ],
      }),
    );
    expect(readCanvas(server.loadData())?.fileIds).toEqual([parseFileId("F1")]);
  });

  test("truncated payloads throw an Error or read a document, never hang", () => {
    const bytes = serverWith(paragraph(1, "hello world"), paragraph(2, "x")).loadData();
    forAll(
      (random) => int(random, 0, bytes.length),
      (length) => {
        try {
          readCanvas(bytes.slice(0, length));
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      },
      200,
    );
  });

  test("random bytes never produce a non-Error throw", () => {
    forAll(
      (random) => Uint8Array.from({ length: int(random, 0, 60) }, () => int(random, 0, 255)),
      (bytes) => {
        try {
          readCanvas(bytes);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      },
    );
  });
});

describe("embeds", () => {
  const controls: CanvasControl[] = [
    { id: sectionId(10), kind: "user", userId: parseUserId("U1") },
    { channelId: parseChannelId("C1"), id: sectionId(11), kind: "channel" },
    { id: sectionId(12), kind: "date", label: "Today", ms: 1_700_000_000_000 },
    { id: sectionId(13), kind: "emoji", name: "tada" },
  ];

  test("controls are read back as embeds keyed by id", () => {
    const server = new Server();
    server.apply(editOf({ controls }));
    const embeds = readCanvas(server.loadData())?.embeds;
    expect(embeds?.get(sectionId(10))).toEqual({ type: "user", userId: parseUserId("U1") });
    expect(embeds?.get(sectionId(11))).toEqual({
      channelId: parseChannelId("C1"),
      type: "channel",
    });
    expect(embeds?.get(sectionId(12))).toEqual({ ms: 1_700_000_000_000, type: "date" });
    expect(embeds?.get(sectionId(13))).toEqual({ shortcode: "tada", type: "emoji" });
  });
});

describe("readCanvasVersion", () => {
  test("a version with no sections reads empty", () => {
    expect(readCanvasVersion(new Uint8Array(), meta)).toMatchObject({ nodes: [], title: "" });
  });
});
