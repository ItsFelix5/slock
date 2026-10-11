import type { LayoutFrame } from "@slock/types";
import type { ContainerKind, ExistingContainer, FlowEntry } from "./flow.ts";
import { type FrameSpec, frameSpec, isLineNode, sameSpec } from "./frames.ts";
import { listStyleForKind } from "./lineStyles.ts";

export type PlannedChild =
  | { entry: FlowEntry; kind: "entry" }
  | { container: PlannedContainer; kind: "container" };

export interface PlannedContainer {
  absorbed: Set<string>;
  color: number;
  columns: { children: PlannedChild[]; index: number }[];
  id: string;
  isNew: boolean;
  kind: ContainerKind | "wrap";
  lastTouched: boolean;
  parent: PlannedContainer | null;
  sourceId: string | null;
  spec: FrameSpec;
  weights: number[];
}

export interface Tree {
  claimed: Set<string>;
  containers: PlannedContainer[];
  root: PlannedChild[];
}

interface Level {
  candidate: string | null;
  frame: LayoutFrame | null;
  spec: FrameSpec;
}

function levelsFor(entry: FlowEntry, containers: Map<string, ExistingContainer>): Level[] {
  const { existing, node } = entry;
  const levels: Level[] = entry.frames.map((frame, index) => {
    const id = existing?.layoutIds[index] ?? null;
    const compatible = id !== null && containers.get(id)?.kind === frame.kind;
    return { candidate: compatible ? id : null, frame, spec: frameSpec(frame) };
  });
  const listStyle = node && isLineNode(node) ? listStyleForKind(node.kind) : null;
  if (listStyle !== null) {
    const listId = existing?.listId ?? null;
    levels.push({
      candidate: listId !== null && containers.get(listId)?.style === listStyle ? listId : null,
      frame: null,
      spec: { kind: "list", style: listStyle },
    });
  }
  if (node?.kind === "image")
    levels.push({ candidate: existing?.wrapperId ?? null, frame: null, spec: { kind: "wrap" } });
  return levels;
}

function kindOf(spec: FrameSpec): PlannedContainer["kind"] {
  return spec.kind;
}

export function buildTree(
  entries: FlowEntry[],
  containers: Map<string, ExistingContainer>,
  makeId: () => string,
): Tree | { error: string } {
  const root: PlannedChild[] = [];
  const planned: PlannedContainer[] = [];
  const claimed = new Set<string>();
  const closedColumns = new Set<string>();
  let stack: PlannedContainer[] = [];

  function attach(child: PlannedChild) {
    const top = stack.at(-1);
    if (!top) {
      root.push(child);
      return;
    }
    top.columns.at(-1)?.children.push(child);
  }

  function markTouched(touched: boolean) {
    for (const container of stack) container.lastTouched = touched;
  }

  function open(level: Level): PlannedContainer | null {
    const { frame, spec } = level;
    const columnsId = frame?.kind === "columns" ? frame.id : null;
    const sourceId = columnsId ?? level.candidate;
    const reuse =
      sourceId !== null && containers.has(sourceId) && !claimed.has(sourceId) ? sourceId : null;
    if (columnsId !== null && closedColumns.has(columnsId)) return null;
    const id = reuse ?? columnsId ?? makeId();
    const container: PlannedContainer = {
      absorbed: new Set(),
      color: frame?.kind === "callout" ? frame.color : 0,
      columns: [{ children: [], index: frame?.kind === "columns" ? frame.index : 0 }],
      id,
      isNew: reuse === null,
      kind: kindOf(spec),
      lastTouched: false,
      parent: stack.at(-1) ?? null,
      sourceId: reuse,
      spec,
      weights: frame?.kind === "columns" ? frame.weights : [],
    };
    claimed.add(id);
    planned.push(container);
    attach({ container, kind: "container" });
    stack.push(container);
    return container;
  }

  function continues(container: PlannedContainer, level: Level, entry: FlowEntry): boolean {
    if (!sameSpec(container.spec, level.spec)) return false;
    if (level.spec.kind === "columns") return true;
    const { candidate } = level;
    if (candidate === null || candidate === container.sourceId) return true;
    if (container.absorbed.has(candidate)) return true;
    if (container.sourceId === null && !claimed.has(candidate)) {
      claimed.delete(container.id);
      container.id = candidate;
      container.isNew = false;
      container.sourceId = candidate;
      claimed.add(candidate);
      return true;
    }
    if (entry.touched || container.lastTouched) {
      container.absorbed.add(candidate);
      return true;
    }
    return false;
  }

  for (const entry of entries) {
    const levels = levelsFor(entry, containers);
    let depth = 0;
    while (depth < stack.length && depth < levels.length) {
      const container = stack[depth];
      const level = levels[depth];
      if (!(container && level) || level.spec.kind === "wrap") break;
      if (!continues(container, level, entry)) break;
      if (level.frame?.kind === "columns") {
        const current = container.columns.at(-1);
        if (current && current.index !== level.frame.index) {
          if (level.frame.index < current.index) return { error: "invalid_layout" };
          container.columns.push({ children: [], index: level.frame.index });
        }
      }
      depth++;
    }
    for (const container of stack.slice(depth)) {
      if (container.spec.kind === "columns") closedColumns.add(container.id);
    }
    stack = stack.slice(0, depth);
    for (const level of levels.slice(depth)) {
      if (!open(level)) return { error: "invalid_layout" };
    }
    attach({ entry, kind: "entry" });
    markTouched(entry.touched);
  }
  return { claimed, containers: planned, root };
}
