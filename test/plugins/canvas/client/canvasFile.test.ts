import { expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { createCanvasFileQuery } from "../../../../packages/plugins/src/canvas/client/lib/canvasRequests";
import { fid } from "../../../support/slack";
import { canvasHost, reply, settle, watch } from "./canvasHost";

test("a canvas link that failed to load is asked for again", async () => {
  const { env } = await canvasHost();
  let online = false;
  env.fetch.respond("/api/canvases/F1/file-info", () =>
    online
      ? reply({ file: { id: "F1", permalink: "https://slack/F1" } })
      : new Response("", { status: 500 }),
  );
  const file = createRoot(() => createCanvasFileQuery(() => fid("F1")));
  const permalink = watch(() => file().data?.permalink);
  await settle();
  expect(permalink()).toBeUndefined();

  online = true;
  env.advance(30_000);
  await settle();
  expect(permalink()).toBe("https://slack/F1");
});
