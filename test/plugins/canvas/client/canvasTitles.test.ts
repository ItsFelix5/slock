import { describe, expect, test } from "bun:test";
import { createCanvasStore } from "../../../../packages/plugins/src/canvas/client/store";
import { fid } from "../../../support/slack";
import { canvasHost, reply, settle, watch } from "./canvasHost";

describe("canvas titles", () => {
  test("listing a channel's canvases does not fetch their titles until asked", async () => {
    const { channel, env, panes, requests } = await canvasHost();
    env.fetch.respond("/api/canvases/F1/file-info", () =>
      reply({ file: { id: "F1", title: "Plan" } }),
    );
    const store = createCanvasStore({ panes });

    store.canvasesFor(channel);
    await settle();
    expect(store.canvasesFor(channel).map((canvas) => canvas.fileId)).toEqual([fid("F1")]);
    expect(requests("/file-info")).toBe(0);

    store.canvasTitle(fid("F1"));
    await settle();
    expect(store.canvasTitle(fid("F1"))).toBe("Plan");
    expect(requests("/file-info")).toBe(1);
  });

  test("a failed title fetch is retried while the title is shown", async () => {
    const { env, panes } = await canvasHost();
    let online = false;
    env.fetch.respond("/api/canvases/F1/file-info", () =>
      online ? reply({ file: { id: "F1", title: "Plan" } }) : new Response("", { status: 500 }),
    );
    const store = createCanvasStore({ panes });
    const title = watch(() => store.canvasTitle(fid("F1")));
    for (let i = 0; i < 5; i++) {
      await settle();
      env.advance(1_000);
    }
    expect(title()).toBeUndefined();

    online = true;
    env.advance(30_000);
    await settle();
    expect(title()).toBe("Plan");
  });

  test("a canvas that is not visible leaves the channel's list", async () => {
    const { channel, env, panes } = await canvasHost();
    env.fetch.respond("/api/canvases/F1/file-info", () => reply({ file: null }));
    const store = createCanvasStore({ panes });
    const listed = watch(() => store.canvasesFor(channel).length);
    await settle();
    expect(listed()).toBe(1);

    store.canvasTitle(fid("F1"));
    await settle();
    expect(listed()).toBe(0);
    expect(store.isCanvasNotVisible(fid("F1"))).toBe(true);
  });

  test("a new canvas shows up although the channel view was just fetched", async () => {
    const { channel, env, panes, setTabs } = await canvasHost();
    const store = createCanvasStore({ panes });
    const listed = watch(() => store.canvasesFor(channel).map((canvas) => canvas.fileId));
    await settle();
    expect(listed()).toEqual([fid("F1")]);

    setTabs("F1", "F2");
    store.invalidateChannel(channel);
    await settle();
    expect(listed()).toEqual([fid("F1"), fid("F2")]);
    expect(env.fetch.calls.filter((call) => call.url.includes("/view"))).toHaveLength(2);
  });
});
