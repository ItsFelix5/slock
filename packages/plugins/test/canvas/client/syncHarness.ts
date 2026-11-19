import { parseTeamId } from "@slock/slack";
import type { CanvasEdit, CanvasNode } from "@slock/types";
import type { Op } from "@slock/ui/editor/quill";
import { canvasToOps } from "../../../src/canvas/client/lib/canvasDelta";
import type { CanvasNames } from "../../../src/canvas/client/lib/canvasEmbeds";
import { CanvasEditError, createCanvasSync } from "../../../src/canvas/client/lib/canvasSync";
import { editOf, meta, Server, sectionId } from "../../../src/canvas/protocol/canvasSimulator";

export interface EditorLine {
  sid: string | null;
  text: string;
}

const names: CanvasNames = {
  channel: (id) => id,
  controlLabel: () => "embed",
  emojiText: () => null,
  teamId: parseTeamId("T1"),
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

export async function settle() {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

export function createSyncHarness(initial: string[], title = "Canvas") {
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
  const sent: CanvasEdit[] = [];

  const toOps = (): Op[] =>
    lines.flatMap((line) => [
      ...(line.text ? [{ insert: line.text }] : []),
      { attributes: line.sid ? { sid: line.sid } : {}, insert: "\n" },
    ]);

  const sync = createCanvasSync({
    applyFixes(fixes) {
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
    embeds: new Map(),
    getOps: toOps,
    getTitle: () => currentTitle,
    initialNodes: nodes,
    initialOps: ops,
    initialTitle: title,
    names,
    async send(edit) {
      sent.push(edit);
      await gate;
      const code = failures.shift();
      if (code) throw new CanvasEditError(code);
      server.apply(edit);
    },
    shardChars: server.decoded().meta?.shardChars ?? "abc",
  });

  return {
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
    serverTexts: () => server.nodes().map((node) => ("html" in node ? node.html : "")),
    serverIds: () => server.nodes().map((node) => node.id),
    serverTitle: () => server.title(),
    sent,
    server,
    setLines(next: EditorLine[]) {
      lines = next;
      sync.markDirty();
    },
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
