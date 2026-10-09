import type { CanvasLine, CanvasNode, LayoutFrame } from "@slock/types";

export type FrameSpec =
  | { color: number; kind: "callout" }
  | { id: string; kind: "columns" }
  | { kind: "list"; style: number }
  | { kind: "quote" }
  | { kind: "wrap" };

export function frameSpec(frame: LayoutFrame): FrameSpec {
  if (frame.kind === "columns") return { id: frame.id, kind: "columns" };
  return frame;
}

export function sameSpec(a: FrameSpec, b: FrameSpec): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "callout" && b.kind === "callout") return a.color === b.color;
  if (a.kind === "columns" && b.kind === "columns") return a.id === b.id;
  if (a.kind === "list" && b.kind === "list") return a.style === b.style;
  return a.kind !== "wrap";
}

export function sameFrames(a: LayoutFrame[], b: LayoutFrame[]): boolean {
  return (
    a.length === b.length &&
    a.every((frame, index) => {
      const other = b[index];
      if (!other || frame.kind !== other.kind) return false;
      if (frame.kind === "callout" && other.kind === "callout") return frame.color === other.color;
      if (frame.kind === "columns" && other.kind === "columns")
        return (
          frame.id === other.id &&
          frame.index === other.index &&
          frame.weights.join(",") === other.weights.join(",")
        );
      return true;
    })
  );
}

export function nodeFrames(node: CanvasNode | null, fallback: LayoutFrame[]): LayoutFrame[] {
  return node ? node.frames : fallback;
}

export function isLineNode(node: CanvasNode): node is CanvasLine {
  return node.kind !== "file" && node.kind !== "image" && node.kind !== "table";
}

export function layoutAttribute(frames: LayoutFrame[]): string | null {
  const parts = frames.flatMap((frame) => {
    if (frame.kind === "quote") return ["quote"];
    if (frame.kind === "callout") return [`callout:${frame.color}`];
    return [];
  });
  return parts.length > 0 ? parts.join("/") : null;
}

export function framesFromAttribute(value: unknown): LayoutFrame[] {
  if (typeof value !== "string") return [];
  return value.split("/").flatMap((part): LayoutFrame[] => {
    if (part === "quote") return [{ kind: "quote" }];
    const color = part.startsWith("callout:") ? Number(part.slice("callout:".length)) : Number.NaN;
    return Number.isInteger(color) ? [{ color, kind: "callout" }] : [];
  });
}

export function withQuote(frames: LayoutFrame[], on: boolean): LayoutFrame[] {
  const rest = frames.filter((frame) => frame.kind !== "quote");
  return on ? [...rest, { kind: "quote" }] : rest;
}

export function withCallout(frames: LayoutFrame[], color: number | null): LayoutFrame[] {
  const rest = frames.filter((frame) => frame.kind !== "callout");
  return color === null ? rest : [{ color, kind: "callout" }, ...rest];
}
