import { isRecord } from "./rawTypes";

export type CanvasLineKind =
  | "bullet"
  | "checklist"
  | "code"
  | "divider"
  | "heading"
  | "ordered"
  | "paragraph"
  | "quote";

export interface CanvasLine {
  checked: boolean;
  html: string;
  id: string;
  indent: number;
  kind: CanvasLineKind;
  level: number;
}

export type CanvasControl = { id: string } & (
  | { channelId: string; kind: "channel" }
  | { kind: "date"; ms: number }
  | { kind: "emoji"; name: string; teamId: string }
  | { kind: "user"; userId: string }
);

export interface CanvasLineUpsert {
  after: string | null;
  line: CanvasLine;
}

export interface CanvasEdit {
  controls: CanvasControl[];
  deleted: string[];
  title: string | null;
  upserts: CanvasLineUpsert[];
}

const LINE_KINDS: readonly string[] = [
  "bullet",
  "checklist",
  "code",
  "divider",
  "heading",
  "ordered",
  "paragraph",
  "quote",
];

function isCanvasLine(value: unknown): value is CanvasLine {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.html === "string" &&
    typeof value.checked === "boolean" &&
    Number.isInteger(value.indent) &&
    Number.isInteger(value.level) &&
    typeof value.kind === "string" &&
    LINE_KINDS.includes(value.kind)
  );
}

function isCanvasControl(value: unknown): value is CanvasControl {
  if (!isRecord(value) || typeof value.id !== "string") return false;
  if (value.kind === "user") return typeof value.userId === "string";
  if (value.kind === "channel") return typeof value.channelId === "string";
  if (value.kind === "emoji")
    return typeof value.name === "string" && typeof value.teamId === "string";
  return value.kind === "date" && typeof value.ms === "number" && Number.isFinite(value.ms);
}

function isUpsert(value: unknown): value is CanvasLineUpsert {
  return (
    isRecord(value) &&
    (value.after === null || typeof value.after === "string") &&
    isCanvasLine(value.line)
  );
}

export function parseCanvasEdit(payload: unknown): CanvasEdit | null {
  if (!isRecord(payload)) return null;
  const { controls, deleted, title, upserts } = payload;
  if (!(Array.isArray(controls) && controls.every(isCanvasControl))) return null;
  if (!(Array.isArray(deleted) && deleted.every((id) => typeof id === "string"))) return null;
  if (!(Array.isArray(upserts) && upserts.every(isUpsert))) return null;
  if (title !== null && typeof title !== "string") return null;
  return { controls, deleted, title, upserts };
}
