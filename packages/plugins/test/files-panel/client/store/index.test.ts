import { describe, expect, jest, test } from "bun:test";
import { int, pick, seededRandom } from "@slock/core/testing";
import type { SlackFile, SlackLink } from "@slock/types";
import { createRoot } from "solid-js";
import { createFilesLinksPanel } from "../../../../src/files-panel/client/store/index";
import type { searchChannelFilesAndLinks } from "../../../../src/slack/client/api";

type Page = Awaited<ReturnType<typeof searchChannelFilesAndLinks>>;
type Call = {
  channelId: string;
  page: number;
  query: string;
  reject: () => void;
  resolve: (page: Page) => void;
};

function file(id: string, created: number): SlackFile {
  return { created, id, isImage: false, name: id, urlPrivate: `https://files/${id}` };
}

function link(ts: string, url = `https://example.com/${ts}`): SlackLink {
  return { title: null, ts, url };
}

function page(files: SlackFile[] = [], links: SlackLink[] = [], hasMore = false): Page {
  return { files, filesTotal: files.length, hasMore, links, linksTotal: links.length };
}

function harness() {
  const calls: Call[] = [];
  const opened: string[][] = [];
  let dispose = () => {};
  const panel = createRoot((stop) => {
    dispose = stop;
    return createFilesLinksPanel({
      openMessage: (...args) => opened.push(args.filter((arg) => arg !== undefined)),
      search: (channelId, _channelName, query, pageNumber) =>
        new Promise((resolve, reject) => {
          calls.push({
            channelId,
            page: pageNumber ?? 1,
            query,
            reject: () => reject(new Error("network")),
            resolve,
          });
        }),
      title: (channelId) => `name-${channelId}`,
    });
  });
  return { calls, dispose, opened, panel };
}

const settle = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

describe("loading", () => {
  test("open starts a page 1 load and merges files and links newest first", async () => {
    const { calls, panel } = harness();
    panel.openFilesLinksPanel("C1");
    expect(panel.filesLinksChannelId()).toBe("C1");
    expect(panel.filesLinksLoading()).toBe(true);
    expect(calls.map(({ channelId, page, query }) => [channelId, page, query])).toEqual([
      ["C1", 1, ""],
    ]);
    calls[0]?.resolve(page([file("F1", 100), file("F2", 300)], [link("200.000100")]));
    await settle();
    expect(panel.filesLinksLoading()).toBe(false);
    expect(
      panel.filesLinksEntries().map((entry) => (entry.kind === "file" ? entry.file.id : "link")),
    ).toEqual(["F2", "link", "F1"]);
  });

  test("a failed load shows the error and retry clears it", async () => {
    const { calls, panel } = harness();
    panel.openFilesLinksPanel("C1");
    calls[0]?.reject();
    await settle();
    expect(panel.filesLinksLoadError()).toBe(true);
    expect(panel.filesLinksLoading()).toBe(false);
    panel.retryFilesLinks();
    expect(panel.filesLinksLoadError()).toBe(false);
    calls[1]?.resolve(page([file("F1", 1)]));
    await settle();
    expect(panel.filesLinksEntries()).toHaveLength(1);
  });

  test("retry without an open panel does nothing", () => {
    const { calls, panel } = harness();
    panel.retryFilesLinks();
    expect(calls).toEqual([]);
  });
});

describe("closing", () => {
  test("a result that arrives after close is dropped", async () => {
    const { calls, panel } = harness();
    panel.openFilesLinksPanel("C1");
    panel.closeFilesLinksPanel();
    expect(panel.filesLinksChannelId()).toBeNull();
    expect(panel.filesLinksLoading()).toBe(false);
    calls[0]?.resolve(page([file("F1", 1)], [], true));
    await settle();
    expect(panel.filesLinksEntries()).toEqual([]);
    expect(panel.filesLinksHasMore()).toBe(false);
    expect(panel.filesLinksLoading()).toBe(false);
  });

  test("an error that arrives after close is dropped", async () => {
    const { calls, panel } = harness();
    panel.openFilesLinksPanel("C1");
    panel.closeFilesLinksPanel();
    calls[0]?.reject();
    await settle();
    expect(panel.filesLinksLoadError()).toBe(false);
  });

  test("a slow channel A load never lands in channel B", async () => {
    const { calls, panel } = harness();
    panel.openFilesLinksPanel("A");
    panel.openFilesLinksPanel("B");
    calls[1]?.resolve(page([file("FB", 5)]));
    await settle();
    calls[0]?.resolve(page([file("FA", 9)]));
    await settle();
    expect(panel.filesLinksChannelId()).toBe("B");
    expect(panel.filesLinksEntries().map((entry) => entry.sortTs)).toEqual([5]);
  });

  test("close cancels a pending debounced query", () => {
    jest.useFakeTimers();
    const { calls, panel } = harness();
    panel.openFilesLinksPanel("C1");
    panel.setFilesLinksQuery("report");
    panel.closeFilesLinksPanel();
    jest.advanceTimersByTime(1000);
    expect(calls).toHaveLength(1);
    jest.useRealTimers();
  });

  test("opening again cancels a debounced query from the previous channel", () => {
    jest.useFakeTimers();
    const { calls, panel } = harness();
    panel.openFilesLinksPanel("A");
    panel.setFilesLinksQuery("old");
    panel.openFilesLinksPanel("B");
    jest.advanceTimersByTime(1000);
    expect(calls.map(({ channelId, query }) => [channelId, query])).toEqual([
      ["A", ""],
      ["B", ""],
    ]);
    jest.useRealTimers();
  });

  test("jumping to a message closes the panel and opens the message", () => {
    const { opened, panel } = harness();
    panel.openFilesLinksPanel("C1");
    panel.jumpToFilesLinksMessage("C1", "1.5", "1.0");
    expect(panel.filesLinksChannelId()).toBeNull();
    expect(opened).toEqual([["C1", "1.5", "1.0"]]);
  });
});

describe("query", () => {
  test("typing debounces to one search with the last query", () => {
    jest.useFakeTimers();
    const { calls, panel } = harness();
    panel.openFilesLinksPanel("C1");
    panel.setFilesLinksQuery("r");
    jest.advanceTimersByTime(200);
    panel.setFilesLinksQuery("re");
    jest.advanceTimersByTime(299);
    expect(calls).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(calls.map(({ page, query }) => [page, query])).toEqual([
      [1, ""],
      [1, "re"],
    ]);
    jest.useRealTimers();
  });

  test("a new query replaces the rows instead of appending", async () => {
    jest.useFakeTimers();
    const { calls, panel } = harness();
    panel.openFilesLinksPanel("C1");
    calls[0]?.resolve(page([file("F1", 1), file("F2", 2)]));
    await settle();
    panel.setFilesLinksQuery("x");
    jest.advanceTimersByTime(300);
    calls[1]?.resolve(page([file("F3", 3)]));
    await settle();
    expect(panel.filesLinksEntries()).toHaveLength(1);
    jest.useRealTimers();
  });
});

describe("pagination", () => {
  test("load more appends the next page and dedupes repeats", async () => {
    const { calls, panel } = harness();
    panel.openFilesLinksPanel("C1");
    calls[0]?.resolve(page([file("F1", 10)], [link("5.1")], true));
    await settle();
    panel.loadMoreFilesLinks();
    expect(calls[1]?.page).toBe(2);
    calls[1]?.resolve(page([file("F1", 10), file("F0", 1)], [link("5.1"), link("2.1")], false));
    await settle();
    expect(panel.filesLinksEntries().map((entry) => entry.sortTs)).toEqual([10, 5.1, 2.1, 1]);
    expect(panel.filesLinksHasMore()).toBe(false);
  });

  test("load more is blocked while loading, after an error, and without more pages", async () => {
    const { calls, panel } = harness();
    panel.openFilesLinksPanel("C1");
    panel.loadMoreFilesLinks();
    expect(calls).toHaveLength(1);
    calls[0]?.resolve(page([file("F1", 1)], [], false));
    await settle();
    panel.loadMoreFilesLinks();
    expect(calls).toHaveLength(1);
    panel.openFilesLinksPanel("C2");
    calls[1]?.reject();
    await settle();
    panel.loadMoreFilesLinks();
    expect(calls).toHaveLength(2);
  });

  test("load more does nothing when the panel is closed", () => {
    const { calls, panel } = harness();
    panel.loadMoreFilesLinks();
    expect(calls).toEqual([]);
  });
});

describe("invariant", () => {
  test("after close nothing changes whatever order late responses arrive in", async () => {
    const actions = ["open", "query", "more", "resolve", "reject", "close"] as const;
    for (let seed = 1; seed <= 60; seed++) {
      jest.useFakeTimers();
      const random = seededRandom(seed);
      const { calls, panel } = harness();
      const steps = int(random, 3, 20);
      for (let step = 0; step < steps; step++) {
        const action = pick(random, actions);
        if (action === "open") panel.openFilesLinksPanel(pick(random, ["A", "B"]));
        else if (action === "query") panel.setFilesLinksQuery(pick(random, ["", "x", "yy"]));
        else if (action === "more") panel.loadMoreFilesLinks();
        else if (action === "close") panel.closeFilesLinksPanel();
        else if (action === "resolve") {
          calls[int(random, 0, Math.max(0, calls.length - 1))]?.resolve(
            page([file(`F${step}`, step)], [link(`${step}.1`)], random() > 0.5),
          );
        } else calls[int(random, 0, Math.max(0, calls.length - 1))]?.reject();
        jest.advanceTimersByTime(int(random, 0, 400));
        await settle();
      }
      panel.closeFilesLinksPanel();
      const before = panel.filesLinksEntries();
      for (const call of calls) call.resolve(page([file("LATE", 999)], [], true));
      jest.advanceTimersByTime(1000);
      await settle();
      expect(panel.filesLinksEntries()).toBe(before);
      expect(panel.filesLinksLoading()).toBe(false);
      expect(panel.filesLinksHasMore()).toBe(false);
      expect(panel.filesLinksChannelId()).toBeNull();
      jest.useRealTimers();
    }
  });
});
