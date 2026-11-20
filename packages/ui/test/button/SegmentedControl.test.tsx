import { afterEach, expect, test } from "bun:test";
import { render } from "@solidjs/web";
import SegmentedControl from "../../src/button/SegmentedControl";

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

test("renders its children inside the control", () => {
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(
    () => (
      <SegmentedControl>
        <button type="button">One</button>
        <button type="button">Two</button>
      </SegmentedControl>
    ),
    host,
  );
  expect(host.querySelectorAll(".segmented-control button").length).toBe(2);
});
