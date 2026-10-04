import type { CanvasNode } from "@slock/types";
import { type CanvasEmbed, parseEmbedRecord } from "./embeds.ts";
import { titleText } from "./flow.ts";
import { buildFlow } from "./read.ts";
import { type CanvasMeta, decodeLoadData, ORPHANED_EMBED_RECORDS_ANCHOR } from "./sections.ts";

export interface CanvasDocument {
  embeds: Map<string, CanvasEmbed>;
  fileIds: string[];
  meta: CanvasMeta;
  nodes: CanvasNode[];
  title: string;
}

export function readCanvas(bytes: Uint8Array): CanvasDocument | null {
  const decoded = decodeLoadData(bytes);
  if (!decoded.meta) return null;
  const embeds = new Map<string, CanvasEmbed>();
  for (const record of decoded.records) {
    if (record.anchor === ORPHANED_EMBED_RECORDS_ANCHOR && record.id)
      embeds.set(record.id, parseEmbedRecord(record.msg));
  }
  const flow = buildFlow(decoded);
  const nodes = flow.entries.flatMap((entry) => entry.node ?? []);
  const fileIds = new Set<string>();
  for (const embed of embeds.values()) if (embed.type === "file") fileIds.add(embed.fileId);
  for (const node of nodes)
    if (node.kind === "image" || node.kind === "file") fileIds.add(node.fileId);
  return {
    embeds,
    fileIds: [...fileIds],
    meta: decoded.meta,
    nodes,
    title: flow.title ? titleText(flow.title) : "",
  };
}
