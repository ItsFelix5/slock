import { afterEach, describe, expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { createFeedPagination } from "../../../../../src/messages/client/api/pane/scroll/feedPagination";
import { createScrollFeed } from "../../../../../src/messages/client/api/pane/scrollFeedFixture";

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.innerHTML = "";
});

function paginate(options: {
  rows?: number;
  size: () => number;
  canLoadOlder?: () => boolean;
  canLoadNewer?: () => boolean;
}) {
  const loads: string[] = [];
  const fixture = createScrollFeed(
    Array.from({ length: options.rows ?? 3 }, () => 50),
    600,
  );
  const pagination = createRoot((dispose) => {
    disposers.push(dispose);
    return createFeedPagination({
      busy: () => false,
      canLoadNewer: options.canLoadNewer ?? (() => false),
      canLoadOlder: options.canLoadOlder ?? (() => true),
      loadNewer: () => loads.push("newer"),
      loadOlder: () => loads.push("older"),
      ready: () => true,
      scroller: () => fixture.container,
      size: options.size,
    });
  });
  return { loads, pagination };
}

describe("pagination", () => {
  test("a short list loads older history once per size", () => {
    let size = 3;
    const { loads, pagination } = paginate({ size: () => size });
    pagination.check(undefined);
    expect(loads).toEqual(["older"]);
    pagination.check(undefined);
    expect(loads).toEqual(["older"]);
    size = 6;
    pagination.check(undefined);
    expect(loads).toEqual(["older", "older"]);
  });

  test("layout checks never load the edge opposite to the last load", () => {
    let size = 3;
    const { loads, pagination } = paginate({
      canLoadNewer: () => true,
      rows: 30,
      size: () => size,
    });
    pagination.check("newer");
    const afterNewer = [...loads];
    expect(afterNewer.at(-1)).toBe("newer");
    for (const next of [4, 3, 4, 3]) {
      size = next;
      pagination.check(undefined);
    }
    expect(loads).toEqual(afterNewer);
  });

  test("nothing loads when no page is available", () => {
    const { loads, pagination } = paginate({ canLoadOlder: () => false, size: () => 3 });
    pagination.check(undefined);
    expect(loads).toEqual([]);
  });
});
