import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost } from "@slock/core/services";
import type { BlockElement } from "@slock/types";
import ElementRenderer from "../../../packages/blockkit/src/elements/ElementRenderer";
import { createFakeEnv } from "../../support/core";
import { mount, unmountAll } from "../../support/dom";

beforeAll(() => {
  setHost(createHost({ env: createFakeEnv() }));
});

afterEach(unmountAll);

describe("ElementRenderer", () => {
  test("shows a fallback for an element type it does not know", () => {
    const el: BlockElement = { type: "future_widget" };
    const host = mount(() => <ElementRenderer el={el} />);
    expect(host.textContent).toBe("[unsupported element: future_widget]");
  });
});
