import type { TimerHandle } from "@slock/core";
import { service } from "@slock/core/solid";
import type { CanvasControl, CanvasEdit, CanvasNode } from "@slock/types";
import type { Op } from "@slock/ui/editor/quill";
import type { CanvasEmbed } from "../../protocol/api";
import { newSectionId, sameNode } from "../../protocol/api";
import { canvasTitle, canvasToOps } from "./canvasDelta";
import { type CanvasSnapshot, diffSnapshots } from "./canvasDiff";
import type { CanvasNames } from "./canvasEmbeds";
import { embedKey } from "./canvasEmbeds";
import type { IdFix } from "./canvasLineIds";
import { opsToLines } from "./canvasLines";
import { blockChanged, mergeCanvasOps } from "./canvasMerge";
import { annotationIds, buildPool, controlKey } from "./canvasPool";
import type { LoadedCanvas } from "./canvasRequests";

type CanvasSaveStatus = "dirty" | "error" | "saved" | "saving";

export interface CanvasEditorPort {
  apply(ops: Op[], title: string): void;
  applyFixes(fixes: IdFix[]): void;
  focusedBlock(): string | null;
  getOps(): Op[];
  getTitle(): string;
  isBusy(): boolean;
}

interface CanvasSyncOptions {
  editor: CanvasEditorPort;
  embeds: Map<string, CanvasEmbed>;
  initialNodes: CanvasNode[];
  initialOps: Op[];
  initialTitle: string;
  names: CanvasNames;
  onError(error: unknown): void;
  refresh(): Promise<LoadedCanvas | undefined>;
  send(edit: CanvasEdit): Promise<void>;
  shardChars: string;
}

const env = service("env");

const SAVE_DELAY_MS = 700;
const RETRY_BASE_MS = 1500;
const RETRY_MAX_MS = 30_000;
const CONFLICT_CODES = new Set(["unknown_anchor", "no_document"]);
const CONFLICT_ATTEMPTS = 2;
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

export class CanvasEditError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "CanvasEditError";
    this.code = code;
  }
}

function isBlank([first, second]: Op[]): boolean {
  return first?.insert === "\n" && !first.attributes && !second;
}

function detachedEditor(ops: Op[], title: string): CanvasEditorPort {
  const held = { ops, title };
  return {
    apply(next, nextTitle) {
      held.ops = next;
      held.title = nextTitle;
    },
    applyFixes: () => undefined,
    focusedBlock: () => null,
    getOps: () => held.ops,
    getTitle: () => held.title,
    isBusy: () => false,
  };
}

export function createCanvasSync(options: CanvasSyncOptions) {
  let { editor } = options;
  let status: CanvasSaveStatus = "saved";
  const controlKeys = new Map<string, string>();
  const retired = new Set<string>();
  const annotations = new Set<string>();
  const newId = () => newSectionId(options.shardChars);

  function learn(embeds: Map<string, CanvasEmbed>, nodes: CanvasNode[]) {
    for (const [id, embed] of embeds) controlKeys.set(id, embedKey(embed, id));
    for (const id of annotationIds(nodes)) annotations.add(id);
  }

  learn(options.embeds, options.initialNodes);
  let baseline: CanvasSnapshot = { entries: [], title: options.initialTitle };
  baseline.entries = parse(options.initialOps, options.initialNodes, retired).entries;
  let baselineOps = options.initialOps;
  let received: LoadedCanvas["doc"] = null;
  let savedAt = 0;
  let timer: TimerHandle | undefined;
  let inflight: Promise<void> | null = null;
  let changedWhileSaving = false;
  let attempts = 0;

  function schedule(delay: number) {
    env.clearTimeout(timer);
    timer = env.setTimeout(() => void run(), delay);
  }

  function parse(ops: Op[], pooled: CanvasNode[], dropped: ReadonlySet<string>) {
    const controls: CanvasControl[] = [];
    const baselineLines = new Map(
      baseline.entries.flatMap((entry) =>
        "html" in entry.node ? [[entry.id, entry.node.html] as const] : [],
      ),
    );
    const parsed = opsToLines(ops, {
      annotations: new Set(annotations),
      baselineHtml: (id) => baselineLines.get(id),
      controls,
      names: options.names,
      newId,
      pool: buildPool(pooled, controlKeys),
      retired: dropped,
    });
    return { controls, ...parsed };
  }

  function snapshot() {
    const pooled = baseline.entries.map((entry) => entry.node);
    // An editor always holds one line, which an empty canvas must not gain just by being opened.
    const untouched = pooled.length === 0 && isBlank(editor.getOps());
    const { controls, entries, fixes } = parse(untouched ? [] : editor.getOps(), pooled, retired);
    if (fixes.length > 0) editor.applyFixes(fixes);
    return { controls, next: { entries, title: editor.getTitle() }, ops: editor.getOps() };
  }

  // What the editor cannot hold faithfully is not the user's change, so it is never written back.
  function adopt(asked: Op[]) {
    const pooled = baseline.entries.map((entry) => entry.node);
    const wanted = new Map(
      parse(asked, pooled, new Set()).entries.map((entry) => [entry.id, entry.node]),
    );
    const held = new Map(snapshot().next.entries.map((entry) => [entry.id, entry]));
    baseline = {
      ...baseline,
      entries: baseline.entries.flatMap((entry) => {
        const want = wanted.get(entry.id);
        if (!want) return [entry];
        const got = held.get(entry.id);
        if (!got) return [];
        return sameNode(want, got.node) ? [entry] : [got];
      }),
    };
  }

  async function save() {
    const { controls, next, ops } = snapshot();
    const edit = diffSnapshots(baseline, next, controls);
    if (edit) {
      await options.send(edit);
      savedAt = env.now();
    }
    const nextIds = new Set(next.entries.map((entry) => entry.id));
    for (const entry of baseline.entries) if (!nextIds.has(entry.id)) retired.add(entry.id);
    for (const control of controls) {
      controlKeys.set(control.id, controlKey(control));
      if (control.kind === "annotation") annotations.add(control.id);
    }
    baseline = next;
    baselineOps = ops;
  }

  function merge(latest: LoadedCanvas | undefined): boolean {
    const doc = latest?.doc;
    if (!doc || doc === received || latest.fetchedAt < savedAt) return true;
    if (editor.isBusy()) return false;
    learn(doc.embeds, doc.nodes);
    const remoteOps = canvasToOps(doc, options.names);
    const remote = {
      entries: parse(remoteOps, doc.nodes, new Set()).entries,
      title: canvasTitle(doc, options.names),
    };
    if (diffSnapshots(baseline, remote, [])) {
      const block = editor.focusedBlock();
      if (block && blockChanged(baseline.entries, remote.entries, block)) return false;
      const mine = snapshot();
      const ops = mergeCanvasOps({
        base: { entries: baseline.entries, ops: baselineOps },
        local: { entries: mine.next.entries, ops: mine.ops },
        remote: { entries: remote.entries, ops: remoteOps },
      });
      const title = mine.next.title === baseline.title ? remote.title : mine.next.title;
      const present = new Set(remote.entries.map((entry) => entry.id));
      for (const { id } of baseline.entries) if (!present.has(id)) retired.add(id);
      for (const id of present) retired.delete(id);
      baseline = remote;
      baselineOps = remoteOps;
      editor.apply(ops, title);
      adopt(ops);
      if (diffSnapshots(baseline, snapshot().next, [])) markDirty();
    }
    received = doc;
    return true;
  }

  async function fail(error: unknown) {
    const code = error instanceof CanvasEditError ? error.code : "network";
    const conflict = CONFLICT_CODES.has(code);
    attempts += 1;
    if (!conflict || attempts > CONFLICT_ATTEMPTS) options.onError(error);
    if (conflict) merge(await options.refresh());
    status = "error";
    changedWhileSaving = false;
    if (!PERMANENT_CODES.has(code))
      schedule(Math.min(RETRY_BASE_MS * 2 ** (attempts - 1), RETRY_MAX_MS));
  }

  function run(): Promise<void> {
    if (inflight) {
      changedWhileSaving = true;
      return inflight;
    }
    env.clearTimeout(timer);
    status = "saving";
    inflight = save()
      .then(() => {
        attempts = 0;
        status = changedWhileSaving ? "dirty" : "saved";
      }, fail)
      .finally(() => {
        inflight = null;
        const again = changedWhileSaving;
        changedWhileSaving = false;
        if (again) schedule(0);
      });
    return inflight;
  }

  function markDirty() {
    if (inflight) {
      changedWhileSaving = true;
      return;
    }
    status = "dirty";
    schedule(SAVE_DELAY_MS);
  }

  async function flush() {
    const saving = inflight;
    if (saving) await saving;
    if (inflight) return inflight;
    if (status === "dirty" || (!saving && status === "error")) await run();
  }

  return {
    adoptLoaded: () => adopt(options.initialOps),
    detach() {
      if (status !== "saved") {
        const { next, ops } = snapshot();
        editor = detachedEditor(ops, next.title);
      }
      return flush();
    },
    flush,
    hasAnnotation: (id: string) => annotations.has(id),
    isPending: () => status !== "saved",
    markDirty,
    receive: (latest: LoadedCanvas | undefined) => !!inflight || merge(latest),
    status: () => status,
  };
}
