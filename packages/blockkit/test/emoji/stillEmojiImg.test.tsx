import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createSignal, flush } from "solid-js";
import { EmojiFreezeContext } from "../../src/context";
import { mount, unmountAll } from "../../src/domTesting";
import EmojiText from "../../src/emoji/EmojiText";
import { type EmojiSource, EmojiSourceContext } from "../../src/emoji/emojiSource";
import type { StillEmoji } from "../../src/emoji/stillEmoji";

const drawn: string[] = [];
const labels = new Map<ImageBitmap, string>();
const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  drawn.length = 0;
  const context: CanvasRenderingContext2D = Object.assign(Object.create(null), {
    drawImage: (bitmap: ImageBitmap) => drawn.push(labels.get(bitmap) ?? ""),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => context,
  });
});

afterEach(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: originalGetContext,
  });
  unmountAll();
});

function stillSource() {
  const [url, setUrl] = createSignal("/a.png");
  const requests = new Map<string, PromiseWithResolvers<StillEmoji>>();
  const source: EmojiSource = {
    aliasTarget: () => undefined,
    failed: () => false,
    invalidate: () => {},
    load: () => Promise.resolve(),
    loading: () => false,
    names: () => [],
    still: (target) => {
      const request = Promise.withResolvers<StillEmoji>();
      requests.set(target, request);
      return request.promise;
    },
    url: () => url(),
  };
  const finish = async (target: string) => {
    const bitmap: ImageBitmap = Object.create(null);
    labels.set(bitmap, target);
    requests.get(target)?.resolve({ bitmap, x: 0, y: 0 });
    await Promise.resolve();
  };
  return { finish, setUrl, source };
}

function mountFrozen(source: EmojiSource) {
  mount(() => (
    <EmojiFreezeContext value={() => true}>
      <EmojiSourceContext value={source}>
        <EmojiText text=":party:" />
      </EmojiSourceContext>
    </EmojiFreezeContext>
  ));
  flush();
}

describe("frozen emoji", () => {
  test("a still that resolves after the emoji changed is not drawn", async () => {
    const { finish, setUrl, source } = stillSource();
    mountFrozen(source);
    setUrl("/b.png");
    flush();
    await finish("/b.png");
    await finish("/a.png");
    expect(drawn).toEqual(["/b.png"]);
  });

  test("the current still is drawn", async () => {
    const { finish, source } = stillSource();
    mountFrozen(source);
    await finish("/a.png");
    expect(drawn).toEqual(["/a.png"]);
  });
});
