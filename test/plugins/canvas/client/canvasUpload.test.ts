import { afterEach, expect, test } from "bun:test";
import type { Services } from "@slock/core/types";
import Quill from "@slock/ui/editor/quill";
import { createCanvasUploads } from "../../../../packages/plugins/src/canvas/client/lib/canvasUpload";
import { CANVAS_FORMATS } from "../../../../packages/plugins/src/canvas/client/views/canvasBlots/formats";
import "../../../../packages/plugins/src/canvas/client/views/canvasBlots";
import "../../../../packages/plugins/src/canvas/client/views/canvasBlots/embeds";
import { partialService } from "../../../support/core";
import { fid } from "../../../support/slack";
import { canvasHost, reply, settle } from "./canvasHost";

const RealXhr = globalThis.XMLHttpRequest;

class AcceptingXhr {
  status = 200;
  upload = {};
  onload = () => {};
  open() {}
  send() {
    queueMicrotask(this.onload);
  }
}

afterEach(() => {
  Object.assign(globalThis, { XMLHttpRequest: RealXhr });
  document.body.replaceChildren();
});

const rawFile = (id: string) => ({ id, mimetype: "image/png", name: "a.png" });

async function uploadHost(options: { fails?: boolean } = {}) {
  const canvas = await canvasHost();
  const failures: string[] = [];
  const feedback = partialService<Services["feedback"]>({
    caught: (key) => failures.push(key),
  });
  await canvas.host.register({ id: "feedback", setup: (ctx) => ctx.provide("feedback", feedback) });
  Object.assign(globalThis, { XMLHttpRequest: AcceptingXhr });
  let reserved = 0;
  canvas.env.fetch.respond("/api/files/reserve", () => {
    if (options.fails) return new Response(JSON.stringify({ ok: false }), { status: 500 });
    reserved += 1;
    return reply({ file_id: `F${reserved}`, upload_url: "https://upload" });
  });
  canvas.env.fetch.respond("/api/files/complete", () =>
    reply({ files: [rawFile("F1"), rawFile("F2")] }),
  );
  let measured = false;
  for (const id of ["F1", "F2"])
    canvas.env.fetch.respond(`/api/canvases/${id}/file-info`, () => {
      const file = measured ? { ...rawFile(id), original_h: 40, original_w: 80 } : rawFile(id);
      measured = true;
      return reply({ file });
    });
  const element = document.createElement("div");
  document.body.append(element);
  const quill = new Quill(element, { formats: CANVAS_FORMATS });
  quill.setText("first\nsecond\n", "silent");
  let id = 0;
  const uploads = createCanvasUploads({ fileId: fid("F9"), newId: () => `temp:${++id}` });
  const finish = async () => {
    for (let i = 0; i < 4; i++) {
      await settle();
      canvas.env.advance(700);
    }
  };
  return { ...canvas, failures, finish, quill, uploads };
}

const shape = (quill: Quill) =>
  quill
    .getContents()
    .ops.map((op) => (typeof op.insert === "string" ? op.insert : Object.keys(op.insert ?? {})[0]));

test("files land together below their line, even when text is typed while uploading", async () => {
  const { finish, quill, requests, uploads } = await uploadHost();
  const files = [new File(["x"], "a.png"), new File(["y"], "b.png")];

  const done = uploads.upload(quill, files, 2);
  quill.insertText(0, "typed\n", "silent");
  quill.insertText(0, "more\n", "api");
  await finish();
  await done;

  expect(shape(quill)).toEqual(["more\ntyped\nfirst\n", "canvasImage", "canvasImage", "second\n"]);
  expect(requests("/file-info")).toBe(3);
});

test("a failed upload is reported on the canvas and clears its progress", async () => {
  const { failures, finish, quill, uploads } = await uploadHost({ fails: true });

  const done = uploads.upload(quill, [new File(["x"], "a.png")], 0);
  await finish();
  await done;

  expect(failures).toEqual(["F9"]);
  expect(uploads.progress()).toBeUndefined();
  expect(shape(quill)).toEqual(["first\nsecond\n"]);
});
