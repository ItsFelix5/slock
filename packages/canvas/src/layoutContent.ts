import { asMessage, asString, field, type RawMessage } from "./protobufRaw.ts";

export function calloutChildIds(content: RawMessage): string[] {
  const container = asMessage(field(content, 63));
  if (!container) return [];
  const ids: string[] = [];
  for (const item of container.get(1) ?? []) {
    const itemMsg = asMessage(item);
    for (const entry of itemMsg?.get(2) ?? []) {
      const id = asString(entry);
      if (id) ids.push(id);
    }
  }
  return ids;
}

export function blockquoteChildIds(content: RawMessage): string[] {
  const container = asMessage(field(content, 65));
  if (!container) return [];
  const ids: string[] = [];
  for (const entry of container.get(1) ?? []) {
    const id = asString(entry);
    if (id) ids.push(id);
  }
  return ids;
}

export function imageFileIds(content: RawMessage): string[] {
  const ids: string[] = [];
  for (const entry of content.get(2) ?? []) {
    const img = asMessage(entry);
    const full = img && asMessage(field(img, 3));
    const fileId = full && asString(field(full, 5));
    if (fileId) ids.push(fileId);
  }
  return ids;
}

export function sectionChildIds(content: RawMessage): string[] {
  const container = asMessage(field(content, 24));
  if (!container) return [];
  const ids: string[] = [];
  for (const item of container.get(1) ?? []) {
    const itemMsg = asMessage(item);
    const id = itemMsg && asString(field(itemMsg, 1));
    if (id) ids.push(id);
  }
  return ids;
}
