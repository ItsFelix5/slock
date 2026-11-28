import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import Quill from "@slock/ui/editor/quill";
import { createRoot, flush } from "solid-js";
import { createMentionHoverController } from "../../../../packages/plugins/src/composer/client/api/editor/mentionHover";
import { createFakeEnv } from "../../../support/core";

const OPEN_DELAY_MS = 350;
const CLOSE_DELAY_MS = 160;

let env: ReturnType<typeof createFakeEnv>;
let host: ReturnType<typeof createHost>;

beforeEach(async () => {
  env = createFakeEnv();
  host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register();
});
afterEach(() => host.stop());

function mount() {
  const quill = new Quill(document.createElement("div"));
  const mention = (id: string) => {
    const node = document.createElement("span");
    node.className = "bk-mention";
    node.dataset.kind = "usergroup";
    node.dataset.id = id;
    quill.root.append(node);
    return node;
  };
  let dispose = () => {};
  const controller = createRoot((stop) => {
    dispose = stop;
    const created = createMentionHoverController();
    created.bind(quill);
    return created;
  });
  flush();
  const advance = (ms: number) => {
    env.advance(ms);
    flush();
  };
  const over = (node: HTMLElement) =>
    node.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  const out = (node: HTMLElement) =>
    node.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
  return { advance, controller, dispose, mention, out, over };
}

describe("mention hover state", () => {
  test("hovering a mention exposes its target before the card opens", () => {
    const { controller, mention, over } = mount();
    const node = mention("S1");
    over(node);
    flush();
    expect(controller.state()?.anchorEl).toBe(node);
    expect(controller.state()?.target).toEqual({ id: "S1", kind: "usergroup" });
    expect(controller.hoverIntent.open()).toBe(false);
  });

  test("the card opens after the open delay and stays set", () => {
    const { advance, controller, mention, over } = mount();
    over(mention("S1"));
    advance(OPEN_DELAY_MS);
    expect(controller.hoverIntent.open()).toBe(true);
    expect(controller.state()?.target.id).toBe("S1");
  });

  test("leaving closes the card and clears the state", () => {
    const { advance, controller, mention, out, over } = mount();
    const node = mention("S1");
    over(node);
    advance(OPEN_DELAY_MS);
    out(node);
    advance(CLOSE_DELAY_MS);
    expect(controller.hoverIntent.open()).toBe(false);
    expect(controller.state()).toBeUndefined();
  });

  test("leaving before the card opens keeps the pending state until a close", () => {
    const { advance, controller, mention, out, over } = mount();
    const node = mention("S1");
    over(node);
    out(node);
    advance(CLOSE_DELAY_MS);
    expect(controller.hoverIntent.open()).toBe(false);
    expect(controller.state()?.target.id).toBe("S1");
  });

  test("moving to another mention while open swaps the target", () => {
    const { advance, controller, mention, over } = mount();
    const first = mention("S1");
    const second = mention("S2");
    over(first);
    advance(OPEN_DELAY_MS);
    over(second);
    flush();
    expect(controller.state()?.target.id).toBe("S2");
    expect(controller.state()?.anchorEl).toBe(second);
    expect(controller.hoverIntent.open()).toBe(true);
  });

  test("the card closing by itself clears the state", () => {
    const { advance, controller, mention, over } = mount();
    over(mention("S1"));
    advance(OPEN_DELAY_MS);
    controller.hoverIntent.close();
    flush();
    expect(controller.state()).toBeUndefined();
  });

  test("a mention with an invalid id is ignored", () => {
    const { controller, mention, over } = mount();
    const node = mention("S1");
    node.dataset.kind = "user";
    node.dataset.id = "nope";
    over(node);
    flush();
    expect(controller.state()).toBeUndefined();
  });

  test("hovering the same mention again after a close shows it again", () => {
    const { advance, controller, mention, out, over } = mount();
    const node = mention("S1");
    over(node);
    advance(OPEN_DELAY_MS);
    out(node);
    advance(CLOSE_DELAY_MS);
    over(node);
    flush();
    expect(controller.state()?.target.id).toBe("S1");
  });
});
