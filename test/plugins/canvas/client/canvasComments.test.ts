import { expect, test } from "bun:test";
import type { Services } from "@slock/core/types";
import type { ChannelId, Ts, UserId } from "@slock/types";
import { createRoot, createSignal } from "solid-js";
import {
  createCanvasComments,
  noteCommentActivity,
} from "../../../../packages/plugins/src/canvas/client/lib/canvasComments";
import { partialService } from "../../../support/core";
import { ch, fid, stamp, uid } from "../../../support/slack";
import { canvasHost, reply, settle, watch } from "./canvasHost";

const annotation = "temp:C:abc1";

const root = {
  document_comment: { is_archived: false, thread_id: annotation },
  reply_count: 2,
  text: "quoted",
  ts: "1.000000",
};

async function commentHost(fileId: string) {
  const { env, host, requests } = await canvasHost();
  const opened: [ChannelId, Ts][] = [];
  const composing: (boolean | undefined)[] = [];
  const failures: string[] = [];
  await host.register(
    {
      id: "feedback",
      setup: (ctx) =>
        ctx.provide(
          "feedback",
          partialService<Services["feedback"]>({
            caught: (_, __, message) => void failures.push(message),
          }),
        ),
    },
    {
      id: "message-links",
      setup: (ctx) =>
        ctx.provide(
          "message-links",
          partialService<Services["message-links"]>({
            openThread: (channelId, ts, _, opts) => {
              opened.push([channelId, ts]);
              composing.push(opts?.compose);
            },
          }),
        ),
    },
    {
      id: "users",
      setup: (ctx) =>
        ctx.provide(
          "users",
          partialService<Services["users"]>({
            currentUserId: createSignal<UserId | undefined>(uid("U1"))[0],
          }),
        ),
    },
  );
  env.fetch.respond(`/api/canvases/${fileId}/comments`, () => reply({ threads: [root] }));
  const comments = createRoot(() => createCanvasComments(() => fid(fileId)));
  const threads = watch(comments.started);
  await settle();
  return { comments, composing, env, failures, opened, requests, threads };
}

test("a double click sends a comment reaction once and shows it at once", async () => {
  const { comments, env, requests, threads } = await commentHost("F1");
  env.fetch.hold(/reactions/);
  const thread = { reactions: [], ts: stamp("1.000000") };

  comments.reactToThread(thread, "tada");
  comments.reactToThread(thread, "tada");
  await settle();

  expect(requests("/reactions")).toBe(1);
  expect(threads()?.[0]?.reactions).toEqual([{ count: 1, name: "tada", users: [uid("U1")] }]);
});

test("a known comment opens without asking the server to create it", async () => {
  const { comments, opened, requests } = await commentHost("F2");

  comments.openAnnotation(annotation);

  expect(opened).toEqual([[ch("C2"), stamp("1.000000")]]);
  expect(requests("/comments/open")).toBe(0);
});

test("a new comment is created, opened and marked", async () => {
  const { comments, env, opened } = await commentHost("F3");
  env.fetch.respond("/api/canvases/F3/comments/open", () => reply({ ts: "2.000000" }));

  comments.openAnnotation("temp:C:abc2");
  await settle();

  expect(opened).toEqual([[ch("C3"), stamp("2.000000")]]);
  expect(comments.markedIds()).toEqual([annotation, "temp:C:abc2"]);
});

test("only writing a comment asks for the reply box", async () => {
  const { comments, composing } = await commentHost("F6");

  comments.openAnnotation(annotation);
  comments.openAnnotation(annotation, true);

  expect(composing).toEqual([undefined, true]);
});

test("a refused resolve comes back unresolved", async () => {
  const { comments, env, failures, threads } = await commentHost("F4");
  env.fetch.respond(
    "/api/canvases/F4/comments/resolve",
    () => new Response(JSON.stringify({ error: "not_allowed", ok: false }), { status: 403 }),
  );

  comments.resolve({ reactions: [], ts: stamp("1.000000") }, true);
  await settle();

  expect(threads()?.[0]?.archived).toBe(false);
  expect(failures).toEqual(["Couldn't resolve the comment"]);
});

test("my reply in a comment thread synchronizes it", async () => {
  const { env, requests } = await commentHost("F5");
  env.fetch.respond("/api/canvases/F5/comments/sync", () => reply({}));

  noteCommentActivity(ch("C5"), stamp("9.000000"));
  noteCommentActivity(ch("C5"), stamp("1.000000"));
  await settle();

  expect(requests("/comments/sync")).toBe(1);
});
