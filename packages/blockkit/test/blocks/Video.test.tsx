import { afterEach, describe, expect, test } from "bun:test";
import type { VideoBlock } from "@slock/types";
import { imageSrc } from "@slock/ui";
import { flush } from "solid-js";
import Video from "../../src/blocks/Video";
import { attrs, count, mount, unmountAll } from "../../src/domTesting";

afterEach(unmountAll);

const block = (fields: Partial<VideoBlock>): VideoBlock => ({
  alt_text: "clip",
  thumbnail_url: "https://img.example.com/t.png",
  title: { text: "Clip", type: "plain_text" },
  type: "video",
  video_url: "https://player.example.com/embed/1",
  ...fields,
});

const play = (host: HTMLElement) => {
  host.querySelector<HTMLButtonElement>("button")?.click();
  flush();
};

describe("Video block", () => {
  test("embeds an external https player after play", () => {
    const host = mount(() => <Video block={block({})} />);
    play(host);
    expect(attrs(host, "iframe", "src")).toEqual(["https://player.example.com/embed/1"]);
  });

  test.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "//evil.com/embed",
    `${window.location.origin}/self`,
  ])("never embeds %p", (url) => {
    const host = mount(() => <Video block={block({ video_url: url })} />);
    play(host);
    expect(count(host, "iframe")).toBe(0);
  });

  test("renders a safe provider icon", () => {
    const host = mount(() => (
      <Video block={block({ provider_icon_url: "https://img.example.com/i.png" })} />
    ));
    expect(attrs(host, "img.bk-video-provider-icon", "src")).toEqual([
      imageSrc("https://img.example.com/i.png"),
    ]);
  });

  test.each([
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "//evil.com/i.png",
  ])("drops provider icon %p", (url) => {
    const host = mount(() => <Video block={block({ provider_icon_url: url })} />);
    expect(count(host, "img.bk-video-provider-icon")).toBe(0);
  });

  test("drops an unsafe poster", () => {
    const host = mount(() => <Video block={block({ thumbnail_url: "javascript:alert(1)" })} />);
    expect(host.querySelector<HTMLElement>("button")?.style.backgroundImage ?? "").toBe("");
  });
});
