import { afterEach, describe, expect, test } from "bun:test";
import { attrs, mount, unmountAll } from "../../src/domTesting";
import EmojiText from "../../src/emoji/EmojiText";
import { createEmojiSource, EmojiSourceContext } from "../../src/emoji/emojiSource";

afterEach(unmountAll);

const list = (entries: Record<string, string>) =>
  Promise.resolve({ aliases: new Map<string, string>(), urls: new Map(Object.entries(entries)) });

describe("emoji source", () => {
  test("two block kit instances do not share emoji state", async () => {
    const first = createEmojiSource(() => list({ party: "/first/party.png" }));
    const second = createEmojiSource(() => list({ party: "/second/party.png" }));
    const host = mount(() => (
      <>
        <EmojiSourceContext value={first}>
          <EmojiText text=":party:" />
        </EmojiSourceContext>
        <EmojiSourceContext value={second}>
          <EmojiText text=":party:" />
        </EmojiSourceContext>
      </>
    ));
    await Promise.all([first.load(), second.load()]);
    await Promise.resolve();
    expect(attrs(host, "img", "src")).toEqual(["/first/party.png", "/second/party.png"]);
  });

  test("loading one source leaves the other unloaded", async () => {
    const loaded = createEmojiSource(() => list({ party: "/party.png" }));
    const idle = createEmojiSource(() => list({ party: "/party.png" }));
    await loaded.load();
    expect(loaded.url("party")).toBe("/party.png");
    expect(loaded.url("missing")).toBeNull();
    expect(idle.url("party")).toBeUndefined();
    expect(idle.names()).toEqual([]);
  });

  test("a failed load reports the error and can be retried", async () => {
    let attempts = 0;
    const source = createEmojiSource(() =>
      ++attempts === 1 ? Promise.reject(new Error("down")) : list({ party: "/party.png" }),
    );
    await source.load();
    expect(source.failed()).toBe(true);
    await source.load();
    expect(source.failed()).toBe(false);
    expect(source.url("party")).toBe("/party.png");
  });

  test("invalidate makes the next load refetch", async () => {
    let attempts = 0;
    const source = createEmojiSource(() => list({ [`e${++attempts}`]: "/x.png" }));
    await source.load();
    source.invalidate();
    await source.load();
    expect(source.names()).toEqual(["e2"]);
  });
});
