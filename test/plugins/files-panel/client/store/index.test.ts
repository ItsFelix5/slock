import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { createHost } from "@slock/core";
import { parseChannelId, parseFileId, parseTs, slackErrorOf } from "@slock/slack";
import type { ChannelId, SlackFile, SlackLink } from "@slock/types";
import { createRoot, flush } from "solid-js";
import type { searchChannelFilesAndLinks } from "../../../../../packages/plugins/src/files-panel/client/requests";
import { createFilesLinksPanel } from "../../../../../packages/plugins/src/files-panel/client/store/index";
import { createFakeEnv, type FakeEnv, int, pick, seededRandom } from "../../../../support/core";
import { startQueryHost } from "../../../../support/queryHost";

let env: FakeEnv;
let host: ReturnType<typeof createHost>;

beforeEach(async () => {
  env = createFakeEnv();
  host = await startQueryHost(env);
});

afterEach(() => host.stop());

type Page = Awaited<ReturnType<typeof searchChannelFilesAndLinks>>;
type Call = {
  channelId: ChannelId;
  page: number;
  query: string;
  reject: () => void;
  resolve: (page: Page) => void;
  signal: AbortSignal;
};

function file(id: string, created: number): SlackFile {
  return {
    created,
    id: parseFileId(id),
    isImage: false,
    name: id,
    urlPrivate: `https://files/${id}`,
  };
}

function link(ts: string, url = `https://example.com/${ts}`): SlackLink {
  return { title: null, ts: parseTs(ts), url };
}

function page(files: SlackFile[] = [], links: SlackLink[] = [], hasMore = false): Page {
  return { files, filesTotal: files.length, hasMore, links, linksTotal: links.length };
}

function harness() {
  const calls: Call[] = [];
  const opened: string[][] = [];
  const panel = createRoot(() =>
    createFilesLinksPanel({
      openMessage: (...args) => opened.push(args.filter((arg) => arg !== undefined)),
      search: (channelId, _channelName, query, pageNumber, signal) =>
        new Promise((resolve, reject) => {
          calls.push({
            channelId: parseChannelId(channelId),
            page: pageNumber,
            query,
            reject: () => reject(slackErrorOf({ code: "not_allowed", fallback: "" })),
            resolve,
            signal,
          });
        }),
      title: (channelId) => `name-${channelId}`,
    }),
  );
  const open = (channelId: ChannelId) => {
    panel.openFilesLinksPanel(channelId);
    flush();
  };
  const advance = (ms: number) => {
    env.advance(ms);
    flush();
  };
  return { advance, calls, open, opened, panel };
}

const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
    flush();
  }
};

const C1 = parseChannelId("C1");
const C2 = parseChannelId("C2");
const CA = parseChannelId("CA");
const CB = parseChannelId("CB");

describe("loading", () => {
  test("open starts a page 1 load and merges files and links newest first", async () => {
    const { calls, open, panel } = harness();
    open(C1);
    expect(panel.filesLinksChannelId()).toBe(C1);
    expect(panel.filesLinksLoading()).toBe(true);
    expect(calls.map(({ channelId, page, query }) => [channelId, page, query])).toEqual([
      ["C1", 1, ""],
    ]);
    calls[0]?.resolve(page([file("F1", 100), file("F2", 300)], [link("200.000100")]));
    await settle();
    expect(panel.filesLinksLoading()).toBe(false);
    expect(
      panel
        .filesLinksEntries()
        .map((entry): string => (entry.kind === "file" ? entry.file.id : "link")),
    ).toEqual(["F2", "link", "F1"]);
  });

  test("a failed load shows the error and retry clears it", async () => {
    const { calls, open, panel } = harness();
    open(C1);
    calls[0]?.reject();
    await settle();
    expect(panel.filesLinksLoadError()).toBe(true);
    expect(panel.filesLinksLoading()).toBe(false);
    panel.retryFilesLinks();
    flush();
    expect(panel.filesLinksLoadError()).toBe(false);
    calls[1]?.resolve(page([file("F1", 1)]));
    await settle();
    expect(panel.filesLinksEntries()).toHaveLength(1);
  });
});

describe("closing", () => {
  test("a result that arrives after close is dropped", async () => {
    const { calls, open, panel } = harness();
    open(C1);
    panel.closeFilesLinksPanel();
    await settle();
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(panel.filesLinksChannelId()).toBeNull();
    expect(panel.filesLinksLoading()).toBe(false);
    calls[0]?.resolve(page([file("F1", 1)], [], true));
    await settle();
    expect(panel.filesLinksEntries()).toEqual([]);
    expect(panel.filesLinksHasMore()).toBe(false);
    expect(panel.filesLinksLoading()).toBe(false);
  });

  test("an error that arrives after close is dropped", async () => {
    const { calls, open, panel } = harness();
    open(C1);
    panel.closeFilesLinksPanel();
    calls[0]?.reject();
    await settle();
    expect(panel.filesLinksLoadError()).toBe(false);
  });

  test("a slow channel A load never lands in channel B", async () => {
    const { calls, open, panel } = harness();
    open(CA);
    open(CB);
    calls[1]?.resolve(page([file("FB", 5)]));
    await settle();
    calls[0]?.resolve(page([file("FA", 9)]));
    await settle();
    expect(panel.filesLinksChannelId()).toBe(CB);
    expect(panel.filesLinksEntries().map((entry) => entry.sortTs)).toEqual([5]);
  });

  test("close cancels a pending debounced query", () => {
    const { advance, calls, open, panel } = harness();
    open(C1);
    panel.setFilesLinksQuery("report");
    panel.closeFilesLinksPanel();
    advance(1000);
    expect(calls).toHaveLength(1);
  });

  test("opening again cancels a debounced query from the previous channel", () => {
    const { advance, calls, open, panel } = harness();
    open(CA);
    panel.setFilesLinksQuery("old");
    open(CB);
    advance(1000);
    expect(calls.map(({ channelId, query }) => [channelId, query])).toEqual([
      ["CA", ""],
      ["CB", ""],
    ]);
  });

  test("jumping to a message closes the panel and opens the message", () => {
    const { opened, panel } = harness();
    panel.openFilesLinksPanel(C1);
    panel.jumpToFilesLinksMessage(C1, parseTs("1.5"), parseTs("1.0"));
    flush();
    expect(panel.filesLinksChannelId()).toBeNull();
    expect(opened).toEqual([["C1", "1.5", "1.0"]]);
  });
});

describe("query", () => {
  test("typing debounces to one search with the last query", () => {
    const { advance, calls, open, panel } = harness();
    open(C1);
    panel.setFilesLinksQuery("r");
    advance(200);
    panel.setFilesLinksQuery("re");
    advance(299);
    expect(calls).toHaveLength(1);
    advance(1);
    expect(calls.map(({ page, query }) => [page, query])).toEqual([
      [1, ""],
      [1, "re"],
    ]);
  });

  test("a new query replaces the rows instead of appending", async () => {
    const { advance, calls, open, panel } = harness();
    open(C1);
    calls[0]?.resolve(page([file("F1", 1), file("F2", 2)]));
    await settle();
    panel.setFilesLinksQuery("x");
    advance(300);
    calls[1]?.resolve(page([file("F3", 3)]));
    await settle();
    expect(panel.filesLinksEntries()).toHaveLength(1);
  });
});

describe("pagination", () => {
  test("load more appends the next page and dedupes repeats", async () => {
    const { calls, open, panel } = harness();
    open(C1);
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
    const { calls, open, panel } = harness();
    open(C1);
    panel.loadMoreFilesLinks();
    expect(calls).toHaveLength(1);
    calls[0]?.resolve(page([file("F1", 1)], [], false));
    await settle();
    panel.loadMoreFilesLinks();
    expect(calls).toHaveLength(1);
    open(C2);
    calls[1]?.reject();
    await settle();
    panel.loadMoreFilesLinks();
    expect(calls).toHaveLength(2);
  });

  test("load more and retry do nothing when the panel is closed", () => {
    const { calls, panel } = harness();
    panel.retryFilesLinks();
    panel.loadMoreFilesLinks();
    expect(calls).toEqual([]);
  });
});

describe("invariant", () => {
  test("after close nothing changes whatever order late responses arrive in", async () => {
    const actions = ["open", "query", "more", "resolve", "reject", "close"] as const;
    for (let seed = 1; seed <= 60; seed++) {
      const random = seededRandom(seed);
      const { calls, open, panel } = harness();
      const steps = int(random, 3, 20);
      for (let step = 0; step < steps; step++) {
        const action = pick(random, actions);
        if (action === "open") open(pick(random, [CA, CB]));
        else if (action === "query") panel.setFilesLinksQuery(pick(random, ["", "x", "yy"]));
        else if (action === "more") panel.loadMoreFilesLinks();
        else if (action === "close") panel.closeFilesLinksPanel();
        else if (action === "resolve") {
          calls[int(random, 0, Math.max(0, calls.length - 1))]?.resolve(
            page([file(`F${step}`, step)], [link(`${step}.1`)], random() > 0.5),
          );
        } else calls[int(random, 0, Math.max(0, calls.length - 1))]?.reject();
        env.advance(int(random, 0, 400));
        await settle();
      }
      panel.closeFilesLinksPanel();
      const before = panel.filesLinksEntries();
      for (const call of calls) call.resolve(page([file("FLATE", 999)], [], true));
      env.advance(1000);
      await settle();
      expect(panel.filesLinksEntries()).toBe(before);
      expect(panel.filesLinksLoading()).toBe(false);
      expect(panel.filesLinksHasMore()).toBe(false);
      expect(panel.filesLinksChannelId()).toBeNull();
    }
  });
});
