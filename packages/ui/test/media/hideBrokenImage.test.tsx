import { afterEach, expect, test } from "bun:test";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import HideBrokenImage from "../../src/media/image/HideBrokenImage";
import { imageSrc } from "../../src/media/mediaSrc";

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

test("an image that fails to load is removed, and a new source shows again", () => {
  const [src, setSrc] = createSignal("https://example.test/a.png");
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(() => <HideBrokenImage alt="" src={src()} />, host);

  const img = host.querySelector("img");
  expect(img).not.toBeNull();
  img?.dispatchEvent(new Event("error"));
  expect(host.querySelector("img")).toBeNull();

  setSrc("https://example.test/b.png");
  expect(host.querySelector("img")?.getAttribute("src")).toBe(
    imageSrc("https://example.test/b.png"),
  );
});
