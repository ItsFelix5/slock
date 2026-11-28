import { describe, expect, test } from "bun:test";
import { parseChannelId, parseUserId } from "@slock/slack";
import type { CanvasNode } from "@slock/types";
import { planEdit } from "../../../../packages/plugins/src/canvas/protocol/plan.ts";
import {
  asString,
  decodeRaw,
  field,
} from "../../../../packages/plugins/src/canvas/protocol/protobufRaw.ts";
import { stringField } from "../../../../packages/plugins/src/canvas/protocol/protobufWrite.ts";
import {
  rawMessage,
  rawString,
  rawVarint,
} from "../../../../packages/plugins/src/canvas/protocol/sectionWrite.ts";
import { controlContext, editOf, Server, sectionId } from "./canvasSimulator.ts";

function record(id: string, fields: [number, ReturnType<typeof rawString>][]) {
  return new Map([
    [1, [rawString(id)]],
    [8, [rawString("m")]],
    ...fields.map(([num, value]): [number, ReturnType<typeof rawString>[]] => [num, [value]]),
  ]);
}

describe("canvas wire", () => {
  test("a truncated field is an error, never a shorter message", () => {
    expect(() => decodeRaw(Uint8Array.from(stringField(1, "abc").slice(0, -1)))).toThrow(
      "truncated field",
    );
  });

  test("annotation authors are written as a plain string", () => {
    const server = new Server();
    server.apply(editOf({ controls: [{ id: sectionId(9), kind: "annotation" }] }));
    const content = server.sections.get(sectionId(9))?.get(12)?.[0];
    const annotation = field(decodeRaw(content?.bytes ?? new Uint8Array()), 7);
    const author = field(decodeRaw(annotation?.bytes ?? new Uint8Array()), 1);
    expect(asString(author)).toBe(controlContext.viewerId);
  });

  test("controls carry the labels and emoji images the web client sends", () => {
    const server = new Server();
    server.apply(
      editOf({
        controls: [
          { id: sectionId(1), kind: "user", userId: parseUserId("U1") },
          { channelId: parseChannelId("C1"), id: sectionId(2), kind: "channel" },
          { id: sectionId(3), kind: "emoji", name: "parrot" },
          { id: sectionId(4), kind: "emoji", name: "gone" },
        ],
      }),
    );
    const label = (n: number) => asString(server.sections.get(sectionId(n))?.get(14)?.[0]);
    const emoji = (n: number) => {
      const content = server.sections.get(sectionId(n))?.get(12)?.[0];
      return decodeRaw(
        field(decodeRaw(content?.bytes ?? new Uint8Array()), 48)?.bytes ?? new Uint8Array(),
      );
    };
    expect(label(1)).toBe('<a  href="https://example.slack.com/team/U1">@user</a>');
    expect(label(2)).toBe('<a  href="https://slack.com/archives/C1">#channel</a>');
    expect(label(3)).toBe(":parrot:");
    expect([2, 3, 4, 6].map((num) => asString(field(emoji(3), num)))).toEqual([
      "parrot",
      "se:parrot/E1",
      "https://emoji.example/parrot.png",
      "https://slack-imgs.com/?c=1&o1=gu&url=https%3A%2F%2Femoji.example%2Fparrot.png",
    ]);
    expect([...emoji(4).keys()]).toEqual([2, 3]);
  });

  test("positions of layout members are left alone", () => {
    const server = new Server();
    const quoted: CanvasNode = {
      checked: false,
      frames: [{ kind: "quote" }],
      html: "q",
      id: sectionId(1),
      indent: 0,
      kind: "paragraph",
      level: 0,
    };
    server.apply(editOf({ upserts: [{ after: null, node: quoted }] }));
    server.sections.get(sectionId(1))?.set(8, [rawString("A")]);
    const plan = planEdit(server.decoded(), editOf({}), controlContext);
    expect(plan.ok && plan.writes).toBe(0);
  });

  test("unknown blocks are kept, movable and deletable", () => {
    const server = new Server();
    const text = rawMessage(new Map([[1, [rawString("<b>from the future</b>")]]]));
    server.sections.set(
      "member",
      record("member", [
        [29, rawVarint(1)],
        [12, rawMessage(new Map([[1, [text]]]))],
      ]),
    );
    server.sections.set(
      "future",
      record("future", [
        [9, rawVarint(999)],
        [12, rawMessage(new Map([[400, [rawString("member")]]]))],
      ]),
    );
    const [unknown] = server.nodes();
    expect(unknown).toEqual({ frames: [], id: "future", kind: "unknown", text: "from the future" });

    const line: CanvasNode = {
      checked: false,
      frames: [],
      html: "x",
      id: sectionId(1),
      indent: 0,
      kind: "paragraph",
      level: 0,
    };
    server.apply(editOf({ upserts: [{ after: null, node: line }] }));
    server.apply(editOf({ upserts: unknown ? [{ after: sectionId(1), node: unknown }] : [] }));
    expect(server.nodes().map((node) => node.id)).toEqual([sectionId(1), "future"]);

    server.apply(editOf({ deleted: ["future"] }));
    expect(server.nodes()).toEqual([line]);
    expect(server.sections.has("member")).toBe(false);
  });
});
