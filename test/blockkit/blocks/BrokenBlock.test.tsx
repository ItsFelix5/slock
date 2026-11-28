import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { Block } from "@slock/types";
import BlockKit from "../../../packages/blockkit/src/BlockKit";
import { mount, unmountAll } from "../../support/dom";

afterEach(unmountAll);

describe("a block with missing data", () => {
  test("fails alone and leaves its neighbours", () => {
    const broken: Block[] = JSON.parse(
      '[{"type":"header"},{"type":"markdown","text":"still here"}]',
    );
    const log = spyOn(console, "error").mockImplementation(() => {});
    const host = mount(() => <BlockKit blocks={broken} />);
    expect(host.querySelectorAll(".bk-unsupported")).toHaveLength(1);
    expect(host.textContent).toContain("still here");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
