import type { CanvasEdit, CanvasNode } from "@slock/types";
import type { ControlContext } from "../../../../packages/plugins/src/canvas/protocol/controlWrites.ts";
import { titleText } from "../../../../packages/plugins/src/canvas/protocol/flow.ts";
import { planEdit } from "../../../../packages/plugins/src/canvas/protocol/plan.ts";
import type { RawMessage } from "../../../../packages/plugins/src/canvas/protocol/protobufRaw.ts";
import {
  messageField,
  stringField,
} from "../../../../packages/plugins/src/canvas/protocol/protobufWrite.ts";
import { encodeRawMessage } from "../../../../packages/plugins/src/canvas/protocol/rawEncode.ts";
import { buildFlow } from "../../../../packages/plugins/src/canvas/protocol/read.ts";
import {
  type CanvasMeta,
  type DecodedCanvas,
  decodeRecords,
} from "../../../../packages/plugins/src/canvas/protocol/sections.ts";

const ID_FIELD = 1;
const DELETED_FIELD = 3;

export const meta: CanvasMeta = {
  documentId: "abcdef",
  shardChars: "abc",
  threadId: "thread",
};

export const controlContext: ControlContext = {
  domain: "example.slack.com",
  emojiUrls: new Map([["parrot", "https://emoji.example/parrot.png"]]),
  enterpriseId: "E1",
  viewerId: "JXF9EAREnuU",
};

export function sectionId(n: number): string {
  return `temp:C:abc${n.toString(16).padStart(25, "0")}`;
}

export function editOf(parts: Partial<CanvasEdit>): CanvasEdit {
  return { controls: [], deleted: [], title: null, upserts: [], ...parts };
}

export class Server {
  readonly sections = new Map<string, RawMessage>();

  decoded(): DecodedCanvas {
    const bytes = Uint8Array.from(
      [...this.sections.values()].flatMap((msg) => messageField(1, encodeRawMessage(msg))),
    );
    return { meta, records: decodeRecords(bytes, [1]) };
  }

  loadData(threadFields: number[] = []): Uint8Array {
    const sections = [...this.sections.values()].flatMap((msg) =>
      messageField(7, encodeRawMessage(msg)),
    );
    const thread = [...stringField(1, meta.threadId), ...threadFields];
    const document = [
      ...messageField(3, thread),
      ...messageField(6, stringField(1, meta.documentId)),
      ...sections,
    ];
    return Uint8Array.from(messageField(2, messageField(2, document)));
  }

  versionData(): Uint8Array {
    const records = [...this.sections.values()].flatMap((msg) =>
      messageField(1, encodeRawMessage(msg)),
    );
    return Uint8Array.from(messageField(1, messageField(1, records)));
  }

  nodes(): CanvasNode[] {
    return buildFlow(this.decoded()).entries.map((entry) => entry.node);
  }

  title(): string {
    const { title } = buildFlow(this.decoded());
    return title ? titleText(title) : "";
  }

  apply(edit: CanvasEdit, base: DecodedCanvas = this.decoded()): void {
    const plan = planEdit(base, edit, controlContext);
    if (!plan.ok) throw new Error(plan.error);
    for (const record of decodeRecords(Uint8Array.from(plan.data), [1])) {
      const { id } = record;
      if (!id) continue;
      if ((record.msg.get(DELETED_FIELD)?.[0]?.varint ?? 0n) !== 0n) {
        this.sections.delete(id);
        continue;
      }
      const merged: RawMessage = new Map(this.sections.get(id) ?? []);
      for (const [num, fields] of record.msg) merged.set(num, fields);
      merged.set(ID_FIELD, record.msg.get(ID_FIELD) ?? []);
      this.sections.set(id, merged);
    }
  }
}
