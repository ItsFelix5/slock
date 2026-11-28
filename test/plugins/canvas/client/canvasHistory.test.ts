import { expect, test } from "bun:test";
import type { Services } from "@slock/core/types";
import { parseFileId } from "@slock/slack";
import type { CanvasVersion } from "@slock/types";
import { createRoot } from "solid-js";
import { createCanvasHistory } from "../../../../packages/plugins/src/canvas/client/lib/canvasHistory";
import { partialService } from "../../../support/core";
import { uid } from "../../../support/slack";
import { editOf, meta, Server, sectionId } from "../protocol/canvasSimulator";
import { canvasHost, reply, settle, watch } from "./canvasHost";

const line = (n: number, html: string) => ({
  after: n === 1 ? null : sectionId(n - 1),
  node: {
    checked: false,
    frames: [],
    html,
    id: sectionId(n),
    indent: 0,
    kind: "paragraph" as const,
    level: 0,
  },
});

const version = (sequence: number): CanvasVersion => ({
  authorId: uid("U1"),
  commentOnly: false,
  createdMs: sequence,
  sequence,
  versionId: `v${sequence}`,
});

test("every visit to a version shows that version's own changes", async () => {
  const canvas = await canvasHost();
  await canvas.host.register({
    id: "feedback",
    setup: (ctx) => ctx.provide("feedback", partialService<Services["feedback"]>({})),
  });
  const id = parseFileId("F1");
  const versions = [version(3), version(2), version(1)];
  canvas.env.fetch.respond(`/api/canvases/${id}/versions`, () => reply({ versions }));
  const server = new Server();
  for (const [index, added] of ["first", "second", "third"].entries()) {
    server.apply(editOf({ upserts: [line(index + 1, added)] }));
    const raw = Buffer.from(server.versionData()).toString("base64");
    canvas.env.fetch.respond(new RegExp(`/versions/v${index + 1}\\?`), () => reply({ raw }));
  }
  const history = createRoot(() =>
    createCanvasHistory(
      () => id,
      () => ({
        access: "edit",
        doc: { embeds: new Map(), fileIds: [], meta, nodes: [], title: "" },
        fetchedAt: 0,
      }),
      () => {},
    ),
  );
  const shown = watch(() =>
    history
      .viewing()
      .data?.diff.map((entry) => `${entry.status} ${"html" in entry.node ? entry.node.html : ""}`),
  );
  history.setOpen(true);
  await settle();

  const visits: (string[] | undefined)[] = [];
  for (const sequence of [3, 2, 3, 2]) {
    history.setSelected(version(sequence));
    await settle();
    visits.push(shown());
  }

  const third = ["same first", "same second", "added third"];
  const second = ["same first", "added second"];
  expect(visits).toEqual([third, second, third, second]);
});
