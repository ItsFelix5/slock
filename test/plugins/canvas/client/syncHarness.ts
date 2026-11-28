import { createHost, errorMessage } from "@slock/core";
import { setHost } from "@slock/core/solid";
import type { CanvasEdit, CanvasNode } from "@slock/types";
import type { Op } from "@slock/ui/editor/quill";
import { canvasToOps } from "../../../../packages/plugins/src/canvas/client/lib/canvasDelta";
import type { CanvasNames } from "../../../../packages/plugins/src/canvas/client/lib/canvasEmbeds";
import type { IdFix } from "../../../../packages/plugins/src/canvas/client/lib/canvasLineIds";
import type { LoadedCanvas } from "../../../../packages/plugins/src/canvas/client/lib/canvasRequests";
import {
  CanvasEditError,
  createCanvasSync,
} from "../../../../packages/plugins/src/canvas/client/lib/canvasSync";
import { createFakeEnv } from "../../../support/core";
import { editOf, meta, Server, sectionId } from "../protocol/canvasSimulator";

export interface EditorLine {
  sid: string | null;
  text: string;
}

const names: CanvasNames = {
  channel: (id) => id,
  controlLabel: () => "embed",
  emojiText: () => null,
  user: (id) => id,
};

function paragraph(n: number, html: string): CanvasNode {
  return {
    checked: false,
    frames: [],
    html,
    id: sectionId(n),
    indent: 0,
    kind: "paragraph",
    level: 0,
  };
}

function toLines(ops: Op[]): EditorLine[] {
  const lines: EditorLine[] = [];
  let text = "";
  for (const { attributes, insert } of ops) {
    if (typeof insert !== "string") throw new Error("The harness only edits text lines");
    const parts = insert.split("\n");
    for (const [index, part] of parts.entries()) {
      text += part;
      if (index === parts.length - 1) continue;
      const sid = attributes?.sid;
      lines.push({ sid: typeof sid === "string" ? sid : null, text });
      text = "";
    }
  }
  return lines;
}

export async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

export function createSyncHarness(initial: string[], title = "Canvas") {
  const env = createFakeEnv();
  setHost(createHost({ env }));
  const server = new Server();
  server.apply(
    editOf({
      title,
      upserts: initial.map((html, i) => ({
        after: i === 0 ? null : sectionId(i),
        node: paragraph(i + 1, html),
      })),
    }),
  );
  const nodes = server.nodes();
  const ops = canvasToOps(
    { embeds: new Map(), fileIds: [], meta: server.decoded().meta ?? meta, nodes, title },
    names,
  );
  let lines: EditorLine[] = nodes.map((node) => ({
    sid: node.id,
    text: "html" in node ? node.html : "",
  }));
  let currentTitle = title;
  let gate: Promise<void> = Promise.resolve();
  let failures: string[] = [];
  let distort = (shown: EditorLine[]) => shown;
  const sent: CanvasEdit[] = [];

  const toOps = (): Op[] =>
    lines.flatMap((line) => [
      ...(line.text ? [{ insert: line.text }] : []),
      { insert: "\n", ...(line.sid && { attributes: { sid: line.sid } }) },
    ]);

  const editor = {
    busy: false,
    apply(next: Op[], nextTitle: string) {
      lines = distort(toLines(next));
      currentTitle = nextTitle;
    },
    applyFixes(fixes: IdFix[]) {
      const offsets: number[] = [];
      let offset = 0;
      for (const line of lines) {
        offset += line.text.length;
        offsets.push(offset);
        offset += 1;
      }
      for (const fix of fixes) {
        const row = offsets.indexOf(fix.index);
        const line = lines[row];
        if (line) line.sid = fix.id;
      }
    },
    focusedBlock: () => null,
    getOps: toOps,
    getTitle: () => currentTitle,
    isBusy: () => editor.busy,
  };

  const copy = (): LoadedCanvas => ({
    access: "edit",
    doc: {
      embeds: new Map(),
      fileIds: [],
      meta: server.decoded().meta ?? meta,
      nodes: server.nodes(),
      title: server.title(),
    },
    fetchedAt: env.now(),
  });
  const errors: unknown[] = [];

  const sync = createCanvasSync({
    editor,
    embeds: new Map(),
    initialNodes: nodes,
    initialOps: ops,
    initialTitle: title,
    names,
    onError: (error) => errors.push(error),
    refresh: async () => copy(),
    async send(edit) {
      sent.push(edit);
      await gate;
      const code = failures.shift();
      if (code) throw new CanvasEditError(code);
      try {
        server.apply(edit);
      } catch (error) {
        throw Object.assign(new CanvasEditError(errorMessage(error)), { cause: error });
      }
    },
    shardChars: server.decoded().meta?.shardChars ?? "abc",
  });

  return {
    copy,
    editor,
    env,
    errors,
    failNext: (...codes: string[]) => {
      failures = codes;
    },
    hold() {
      let release = () => {};
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return () => {
        gate = Promise.resolve();
        release();
      };
    },
    lines: () => lines,
    loseOnShow(next: (shown: EditorLine[]) => EditorLine[]) {
      distort = next;
      lines = next(lines);
    },
    names,
    serverTexts: () => server.nodes().map((node) => ("html" in node ? node.html : "")),
    serverIds: () => server.nodes().map((node) => node.id),
    serverTitle: () => server.title(),
    sent,
    server,
    setLines(next: EditorLine[]) {
      lines = next;
      sync.markDirty();
    },
    title: () => currentTitle,
    setTitle(next: string) {
      currentTitle = next;
      sync.markDirty();
    },
    sync,
    async quiesce() {
      for (let i = 0; i < 20; i++) {
        await settle();
        if (!sync.isPending()) return;
        await sync.flush();
      }
    },
  };
}

export type SyncHarness = ReturnType<typeof createSyncHarness>;
