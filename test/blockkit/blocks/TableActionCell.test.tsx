import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost } from "@slock/core/services";
import type { TableBlock } from "@slock/types";
import { Table } from "../../../packages/blockkit/src/blocks/Table";
import { createFakeEnv } from "../../support/core";
import { mount, unmountAll } from "../../support/dom";

beforeAll(() => {
  setHost(createHost({ env: createFakeEnv() }));
});

afterEach(unmountAll);

describe("table action cell", () => {
  test("renders its button inside the cell", () => {
    const block: TableBlock = {
      rows: [
        [{ text: "Task", type: "raw_text" }],
        [
          {
            element: {
              action_id: "done",
              text: { text: "Done", type: "plain_text" },
              type: "button",
            },
            type: "action_cell",
          },
        ],
      ],
      type: "table",
    };
    const root = mount(() => <Table block={block} />);
    expect(root.querySelector("td button")?.textContent).toContain("Done");
  });
});
