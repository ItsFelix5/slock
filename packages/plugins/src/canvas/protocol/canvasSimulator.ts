import type { CanvasEdit, CanvasNode } from "@slock/types";
import { titleText } from "./flow.ts";
import { planEdit } from "./plan.ts";
import type { RawMessage } from "./protobufRaw.ts";
import { messageField, stringField } from "./protobufWrite.ts";
import { encodeRawMessage } from "./rawEncode.ts";
import { buildFlow } from "./read.ts";
import { type CanvasMeta, type DecodedCanvas, decodeRecords } from "./sections.ts";

const ID_FIELD = 1;
const DELETED_FIELD = 3;

export const meta: CanvasMeta = {
  documentId: "abcdef",
  secretPath: "secret",
  shardChars: "abc",
  threadId: "thread",
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

  loadData(): Uint8Array {
    const sections = [...this.sections.values()].flatMap((msg) =>
      messageField(7, encodeRawMessage(msg)),
    );
    const thread = [
      ...stringField(1, meta.threadId),
      ...messageField(7, stringField(9, meta.secretPath)),
    ];
    const document = [
      ...messageField(3, thread),
      ...messageField(6, stringField(1, meta.documentId)),
      ...sections,
    ];
    return Uint8Array.from(messageField(2, messageField(2, document)));
  }

  nodes(): CanvasNode[] {
    return buildFlow(this.decoded()).entries.flatMap((entry) => entry.node ?? []);
  }

  title(): string {
    const { title } = buildFlow(this.decoded());
    return title ? titleText(title) : "";
  }

  apply(edit: CanvasEdit, base: DecodedCanvas = this.decoded()): void {
    const plan = planEdit(base, edit);
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
