import { afterEach, beforeEach, expect, test } from "bun:test";
import { render } from "@solidjs/web";
import { flush } from "solid-js";
import HoverCard from "../../../packages/ui/src/overlay/HoverCard";
import { startFakeEnv } from "../fakeEnv";

let fake: Awaited<ReturnType<typeof startFakeEnv>>;
let dispose: (() => void) | undefined;

beforeEach(async () => {
  fake = await startFakeEnv();
});
afterEach(() => {
  dispose?.();
  document.body.replaceChildren();
  fake.stop();
});

function hoverOpenCard() {
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(
    () => (
      <HoverCard content={() => <button type="button">action</button>}>
        <a href="https://example.com" onClick={(event) => event.preventDefault()}>
          link
        </a>
      </HoverCard>
    ),
    host,
  );
  flush();
  host.querySelector(".hover-card-anchor")?.dispatchEvent(new MouseEvent("mouseenter"));
  fake.env.advance(350);
  flush();
  const press = (selector: string, event: Event) => {
    document.querySelector(selector)?.dispatchEvent(event);
    flush();
  };
  const card = () => document.querySelector(".hover-card");
  return { card, press };
}

const pointerDown = () => new PointerEvent("pointerdown", { bubbles: true });

test("pressing the anchor closes the card", () => {
  const { card, press } = hoverOpenCard();
  expect(card()).not.toBeNull();
  press("a", pointerDown());
  expect(card()).toBeNull();
});

test("activating the anchor by keyboard closes the card", () => {
  const { card, press } = hoverOpenCard();
  press("a", new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  expect(card()).toBeNull();
});

test("pressing inside the card keeps it open", () => {
  const { card, press } = hoverOpenCard();
  press(".hover-card button", pointerDown());
  expect(card()).not.toBeNull();
});
