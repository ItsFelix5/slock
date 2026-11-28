import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Block } from "@slock/types";
import { createRoot, createSignal, flush } from "solid-js";
import { createLinkPreviews } from "../../../../packages/plugins/src/composer/client/lib/linkPreviews";
import { createFakeEnv, type FakeEnv } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";
import { ch } from "../../../support/slack";

const linked = (...urls: string[]): Block[] => [
  {
    elements: [{ elements: urls.map((url) => ({ type: "link", url })), type: "rich_text_section" }],
    type: "rich_text",
  },
];

const ONE = "https://one.example";
const TWO = "https://two.example";

let env: FakeEnv;
let host: Awaited<ReturnType<typeof startQueryHost>>;
let dispose = () => {};

beforeEach(async () => {
  env = createFakeEnv();
  host = await startQueryHost(env);
});

afterEach(async () => {
  dispose();
  await host.stop();
});

const settle = async () => {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
    flush();
  }
};

const requested = () => env.fetch.calls.map((call) => String(call.init?.body));

function mount(...urls: string[]) {
  const [blocks, setBlocks] = createSignal(linked(...urls));
  const previews = createRoot((stop) => {
    dispose = stop;
    return createLinkPreviews({ blocks, channelId: () => ch("C1"), enabled: () => true });
  });
  return {
    previews,
    type: (...next: string[]) => {
      setBlocks(linked(...next));
      flush();
    },
  };
}

const unfurlEverything = () =>
  env.fetch.respond(
    () => true,
    (call) => {
      const { url }: { url: string } = JSON.parse(String(call.init?.body));
      return Response.json(
        url === TWO ? { ok: true } : { attachment: { from_url: url, title: "One" }, ok: true },
      );
    },
  );

const shown = (previews: ReturnType<typeof createLinkPreviews>) =>
  previews.previews().map((preview) => preview.url);

describe("link previews", () => {
  test("asks once per link and shows only links that unfurl", async () => {
    unfurlEverything();
    const { previews, type } = mount(ONE);
    await settle();
    type(ONE, TWO);
    await settle();
    type(ONE, TWO);
    await settle();
    expect(requested()).toHaveLength(2);
    expect(shown(previews)).toEqual([ONE]);
  });

  test("sending waits for a preview that is still loading", async () => {
    env.fetch.hold(() => true);
    const { previews } = mount(ONE);
    await settle();
    const sent = previews.urlsToSend();
    env.fetch
      .pending()[0]
      ?.resolve(Response.json({ attachment: { from_url: ONE, title: "One" }, ok: true }));
    expect(await sent).toEqual([ONE]);
  });

  test("sending gives up on a slow preview after two seconds", async () => {
    env.fetch.hold(() => true);
    const { previews } = mount(ONE);
    await settle();
    const sent = previews.urlsToSend();
    env.advance(2000);
    expect(await sent).toEqual([]);
  });

  test("a dismissed link is neither shown nor sent", async () => {
    unfurlEverything();
    const { previews } = mount(ONE);
    await settle();
    previews.dismiss(ONE);
    flush();
    expect(shown(previews)).toEqual([]);
    expect(await previews.urlsToSend()).toEqual([]);
  });

  test("removing a link aborts its request", async () => {
    env.fetch.hold(() => true);
    const { type } = mount(ONE);
    await settle();
    type();
    await settle();
    expect(env.fetch.calls[0]?.init?.signal?.aborted).toBe(true);
  });
});
