import type { PaneKind } from "../api";
import type { PaneContent } from "../api/types";

export interface NavSnapshot {
  panes: PaneContent[];
}

export type NavMark = { key: string; serialized: string };

function parsePaneSegment(segment: string, kinds: PaneKind[]): PaneContent | null {
  if (!segment) return null;
  for (const kind of kinds) {
    const content = kind.url?.parse(segment);
    if (content) return content;
  }
  return null;
}

function serializePaneSegment(content: PaneContent, kinds: PaneKind[]): string {
  return kinds.find((kind) => kind.kind === content.kind)?.url?.serialize(content) ?? "";
}

const pathSegments = (url: URL) => url.pathname.split("/").filter(Boolean);

export function parseNavPath(url: URL, kinds: PaneKind[]): PaneContent[] {
  return pathSegments(url)
    .map((segment) => parsePaneSegment(segment, kinds))
    .filter((c): c is PaneContent => c !== null);
}

export function parsesCompletely(url: URL, kinds: PaneKind[]): boolean {
  return parseNavPath(url, kinds).length === pathSegments(url).length;
}

export function navSnapshotToPath(snap: NavSnapshot, kinds: PaneKind[]): string {
  const segments = snap.panes.map((content) => serializePaneSegment(content, kinds));
  return `/${segments.filter(Boolean).join("/")}`;
}

export function historyAction(last: NavMark, next: NavMark): "skip" | "push" | "replace" {
  if (next.serialized === last.serialized) return "skip";
  return next.key === last.key ? "replace" : "push";
}
