// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import type { SearchResult } from "@slock/slack-api";
import { navigateToSearchResult } from "../searchResultNavigation";

const result = (patch: Partial<SearchResult> = {}): SearchResult => ({
  channelId: "C123",
  channelName: "general",
  text: "Hello",
  ts: "100.200",
  userId: "U123",
  ...patch,
});

describe("navigateToSearchResult", () => {
  test("opens a root message in its conversation", () => {
    const messages: string[][] = [];
    const threads: (string | undefined)[][] = [];

    navigateToSearchResult(result(), {
      openChannelMessage: (...args) => messages.push(args),
      openChannelPeek: (...args) => threads.push(args),
    });

    expect(messages).toEqual([["C123", "100.200"]]);
    expect(threads).toEqual([]);
  });

  test("opens a reply in its parent thread and highlights the reply", () => {
    const messages: string[][] = [];
    const threads: (string | undefined)[][] = [];

    navigateToSearchResult(result({ threadTs: "100.100" }), {
      openChannelMessage: (...args) => messages.push(args),
      openChannelPeek: (...args) => threads.push(args),
    });

    expect(messages).toEqual([]);
    expect(threads).toEqual([["C123", "100.100", "100.200"]]);
  });

  test("treats a thread root as a conversation message", () => {
    const messages: string[][] = [];

    navigateToSearchResult(result({ threadTs: "100.200" }), {
      openChannelMessage: (...args) => messages.push(args),
      openChannelPeek: () => {},
    });

    expect(messages).toEqual([["C123", "100.200"]]);
  });
});
