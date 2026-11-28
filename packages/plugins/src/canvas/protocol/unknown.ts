import { logUnknown } from "@slock/core";
import type { CanvasUnknown, LayoutFrame } from "@slock/types";
import { sectionText } from "./flow.ts";
import { asMessage, asString, field, maybeMessage, type RawMessage } from "./protobufRaw.ts";
import type { SectionRecord } from "./sections.ts";

const TAG_RE = /<[^>]*>/g;

export function referencedIds(
  record: SectionRecord,
  records: ReadonlyMap<string, SectionRecord>,
): string[] {
  const found = new Set<string>();

  function visit(source: SectionRecord) {
    const content = asMessage(field(source.msg, 12));
    if (content) scan(content);
  }

  function scan(message: RawMessage) {
    for (const entry of [...message.values()].flat()) {
      const id = asString(entry);
      const target = id === null ? undefined : records.get(id);
      if (id !== null && target) {
        if (id === record.id || found.has(id)) continue;
        found.add(id);
        visit(target);
        continue;
      }
      const nested = entry.bytes && maybeMessage(entry.bytes);
      if (nested) scan(nested);
    }
  }

  visit(record);
  return [...found];
}

export function unknownNode(
  id: string,
  record: SectionRecord,
  records: ReadonlyMap<string, SectionRecord>,
  frames: LayoutFrame[],
): CanvasUnknown {
  logUnknown("canvas section", `type ${record.type} style ${record.style}`);
  const members = referencedIds(record, records).flatMap((member) => records.get(member) ?? []);
  const text = [record, ...members]
    .map((source) => sectionText(source).replace(TAG_RE, ""))
    .filter(Boolean)
    .join("\n");
  return { frames, id, kind: "unknown", text };
}
