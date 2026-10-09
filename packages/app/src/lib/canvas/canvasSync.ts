import type { CanvasEmbed } from "@slock/canvas";
import { newSectionId } from "@slock/canvas";
import type { CanvasControl, CanvasEdit, CanvasNode } from "@slock/types";
import type { Op } from "quill";
import { createSignal } from "solid-js";
import { type CanvasSnapshot, diffSnapshots } from "./canvasDiff";
import type { CanvasNames } from "./canvasEmbeds";
import { displayTs, embedKey } from "./canvasEmbeds";
import { type ControlPool, type IdFix, opsToLines } from "./canvasLines";

export type CanvasSaveStatus = "conflict" | "dirty" | "error" | "saved" | "saving";

export interface CanvasSyncOptions {
  applyFixes(fixes: IdFix[]): void;
  embeds: Map<string, CanvasEmbed>;
  getOps(): Op[];
  getTitle(): string;
  initialNodes: CanvasNode[];
  initialOps: Op[];
  initialTitle: string;
  names: CanvasNames;
  send(edit: CanvasEdit): Promise<void>;
  shardChars: string;
}

const SAVE_DELAY_MS = 700;
const RETRY_BASE_MS = 1500;
const RETRY_MAX_MS = 30_000;
const CONFLICT_CODES = new Set(["unknown_anchor", "opaque_block", "no_document"]);
const PERMANENT_CODES = new Set([
  "edit_too_large",
  "invalid_content",
  "invalid_edit",
  "invalid_id",
  "invalid_indent",
  "invalid_layout",
  "invalid_level",
  "invalid_table",
  "line_too_long",
  "not_editable",
]);
const CONTROL_REF_RE = /<control id="([^"]+)"><\/control>/g;
const ANNOTATION_RE = /<annotation id="([^"]+)"/g;

export class CanvasEditError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "CanvasEditError";
    this.code = code;
  }
}

function controlKey(control: CanvasControl): string {
  if (control.kind === "annotation") return `annotation:${control.id}`;
  if (control.kind === "user") return `user:${control.userId}`;
  if (control.kind === "channel") return `channel:${control.channelId}`;
  if (control.kind === "emoji") return `emoji:${control.name}`;
  return `date:${displayTs(control.ms)}`;
}

export function poolLines(nodes: CanvasNode[]): { html: string; id: string }[] {
  return nodes.flatMap((node) => {
    if (node.kind === "table")
      return node.rows.flatMap((row) =>
        row.cells.map((cell) => ({ html: cell.html, id: cell.contentId })),
      );
    return "html" in node ? [{ html: node.html, id: node.id }] : [];
  });
}

function buildPool(
  lines: Iterable<{ html: string; id: string }>,
  keys: Map<string, string>,
): ControlPool {
  const byLine = new Map<string, Map<string, string[]>>();
  for (const { html, id } of lines) {
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

function annotationIds(nodes: CanvasNode[]): string[] {
  return poolLines(nodes).flatMap(({ html }) =>
    [...html.matchAll(ANNOTATION_RE)].flatMap((match) => match[1] ?? []),
  );
}

export function createCanvasSync(options: CanvasSyncOptions) {
  const [status, setStatus] = createSignal<CanvasSaveStatus>("saved");
  const [failure, setFailure] = createSignal<string | null>(null);
  const controlKeys = new Map<string, string>();
  for (const [id, embed] of options.embeds) controlKeys.set(id, embedKey(embed, id));
  const retired = new Set<string>();
  const annotations = new Set(annotationIds(options.initialNodes));
  const newId = () => newSectionId(options.shardChars);
  const initial = opsToLines(options.initialOps, {
    annotations,
    baselineHtml: () => undefined,
    controls: [],
    names: options.names,
    newId,
    pool: buildPool(poolLines(options.initialNodes), controlKeys),
    retired,
  });
  let baseline: CanvasSnapshot = { entries: initial.entries, title: options.initialTitle };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inflight: Promise<void> | null = null;
  let changedWhileSaving = false;
  let attempts = 0;
  let disposed = false;

  function schedule(delay: number) {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), delay);
  }

  function snapshot() {
    const controls: CanvasControl[] = [];
    const baselineLines = new Map(
      baseline.entries.flatMap((entry) =>
        "html" in entry.node ? [[entry.id, entry.node.html] as const] : [],
      ),
    );
    const parsed = opsToLines(options.getOps(), {
      annotations: new Set(annotations),
      baselineHtml: (id) => baselineLines.get(id),
      controls,
      names: options.names,
      newId,
      pool: buildPool(poolLines(baseline.entries.map((entry) => entry.node)), controlKeys),
      retired,
    });
    if (parsed.fixes.length > 0) options.applyFixes(parsed.fixes);
    return { controls, next: { entries: parsed.entries, title: options.getTitle() } };
  }

  async function save() {
    const { controls, next } = snapshot();
    const edit = diffSnapshots(baseline, next, controls);
    if (edit) await options.send(edit);
    const nextIds = new Set(next.entries.map((entry) => entry.id));
    for (const entry of baseline.entries) if (!nextIds.has(entry.id)) retired.add(entry.id);
    for (const control of controls) {
      controlKeys.set(control.id, controlKey(control));
      if (control.kind === "annotation") annotations.add(control.id);
    }
    baseline = next;
  }

  function run(): Promise<void> {
    if (inflight) {
      changedWhileSaving = true;
      return inflight;
    }
    clearTimeout(timer);
    setStatus("saving");
    inflight = save()
      .then(() => {
        attempts = 0;
        setFailure(null);
        setStatus(changedWhileSaving ? "dirty" : "saved");
      })
      .catch((error: unknown) => {
        const code = error instanceof CanvasEditError ? error.code : "network";
        setFailure(code);
        if (CONFLICT_CODES.has(code)) {
          setStatus("conflict");
          return;
        }
        attempts += 1;
        setStatus("error");
        changedWhileSaving = false;
        if (!(disposed || PERMANENT_CODES.has(code)))
          schedule(Math.min(RETRY_BASE_MS * 2 ** (attempts - 1), RETRY_MAX_MS));
      })
      .finally(() => {
        inflight = null;
        const again = changedWhileSaving;
        changedWhileSaving = false;
        if (again && status() !== "conflict" && !disposed) schedule(0);
      });
    return inflight;
  }

  function differsFromRemote(remoteOps: Op[], remoteTitle: string): boolean {
    const remote = opsToLines(remoteOps, {
      annotations: new Set(annotations),
      baselineHtml: () => undefined,
      controls: [],
      names: options.names,
      newId,
      pool: buildPool(poolLines(baseline.entries.map((entry) => entry.node)), controlKeys),
      retired: new Set(),
    });
    const next = { entries: remote.entries, title: remoteTitle };
    return diffSnapshots(baseline, next, []) !== null;
  }

  return {
    differsFromRemote,
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
    failure,
    flush: async () => {
      if (status() === "saved" || status() === "conflict") return;
      await run();
    },
    isPending: () => status() === "dirty" || status() === "saving" || status() === "error",
    markDirty() {
      if (status() === "conflict") return;
      if (inflight) {
        changedWhileSaving = true;
        return;
      }
      setStatus("dirty");
      schedule(SAVE_DELAY_MS);
    },
    retry: () => {
      attempts = 0;
      return run();
    },
    status,
  };
}
