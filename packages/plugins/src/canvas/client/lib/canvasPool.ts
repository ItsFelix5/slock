import type { CanvasControl, CanvasNode } from "@slock/types";
import { htmlLines } from "../../protocol/api";
import { displayTs } from "./canvasEmbeds";
import type { ControlPool } from "./canvasLineIds";

const CONTROL_REF_RE = /<control id="([^"]+)"><\/control>/g;
const ANNOTATION_RE = /<annotation id="([^"]+)"/g;

export function controlKey(control: CanvasControl): string {
  if (control.kind === "annotation") return `annotation:${control.id}`;
  if (control.kind === "user") return `user:${control.userId}`;
  if (control.kind === "channel") return `channel:${control.channelId}`;
  if (control.kind === "emoji") return `emoji:${control.name}`;
  return `date:${displayTs(control.ms)}`;
}

export function buildPool(nodes: CanvasNode[], keys: Map<string, string>): ControlPool {
  const byLine = new Map<string, Map<string, string[]>>();
  for (const { html, id } of htmlLines(nodes)) {
    const perKey = new Map<string, string[]>();
    for (const match of html.matchAll(CONTROL_REF_RE)) {
      const controlId = match[1] ?? "";
      const key = keys.get(controlId) ?? `raw:${controlId}`;
      perKey.set(key, [...(perKey.get(key) ?? []), controlId]);
    }
    byLine.set(id, perKey);
  }
  return { take: (lineId, key) => byLine.get(lineId)?.get(key)?.shift() ?? null };
}

export function annotationIds(nodes: CanvasNode[]): string[] {
  return htmlLines(nodes).flatMap(({ html }) =>
    [...html.matchAll(ANNOTATION_RE)].flatMap((match) => match[1] ?? []),
  );
}
