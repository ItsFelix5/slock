import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv, type FakeEnv, partialService } from "@slock/core/testing";
import type { Services } from "@slock/core/types";
import { render } from "@solidjs/web";
import { createRoot, createSignal, flush } from "solid-js";
import { createMessageSearch } from "../../../../../src/search/client/views/lib/messageSearch";
import MessageSearchResults from "../../../../../src/search/client/views/MessageSearchResults";

const [history] = createSignal<string[]>([]);

let env: FakeEnv;
let host: ReturnType<typeof createHost>;

beforeEach(async () => {
  Object.defineProperty(CSS, "highlights", { configurable: true, value: new Map() });
  env = createFakeEnv();
  host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register({
    id: "search",
    setup: (ctx) =>
      ctx.provide("search", partialService<Services["search"]>({ searchHistory: history })),
  });
});
afterEach(() => host.stop());

async function settle() {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
    flush();
  }
}

const reply = (results: unknown[]) => Response.json({ ok: true, results });

function mount() {
  const searched: string[] = [];
  const root = document.createElement("div");
  document.body.append(root);
  const owner = createRoot((stop) => ({
    search: createMessageSearch(
      () => "relevant",
      (query) => searched.push(query),
    ),
    stop,
  }));
  const { search } = owner;
  const stopView = render(
    () => (
      <MessageSearchResults
        canSearch={true}
        loading={search.loading()}
        onHistorySearch={() => {}}
        onResult={() => {}}
        onSortModeChange={() => {}}
        results={search.results()}
        sortMode="relevant"
      />
    ),
    root,
  );
  return {
    dispose: () => {
      stopView();
      owner.stop();
      root.remove();
    },
    root,
    search,
    searched,
    text: () => root.textContent ?? "",
  };
}

describe("message search results", () => {
  test("a failed search shows the error and Try again asks again", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    let attempts = 0;
    env.fetch.respond(/\/api\/search\/messages/, () => {
      attempts += 1;
      return attempts === 1 ? Response.json({ error: "boom" }, { status: 400 }) : reply([]);
    });
    const view = mount();
    view.search.search("hello");
    flush();
    await settle();
    expect(view.text()).toContain("Couldn't search messages.");
    const retry = [...view.root.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    );
    retry?.click();
    await settle();
    expect(attempts).toBe(2);
    expect(view.text()).toContain("No matches.");
    expect(view.text()).not.toContain("Couldn't search messages.");
    logged.mockRestore();
    view.dispose();
  });

  test("keeps the old results state while loading and records only the answered query", async () => {
    env.fetch.hold(/\/api\/search\/messages/);
    const view = mount();
    view.search.search("a");
    flush();
    expect(view.search.loading()).toBe(true);
    view.search.search("ab");
    flush();
    await settle();
    for (const call of env.fetch.pending()) call.resolve(reply([]));
    await settle();
    expect(view.searched).toEqual(["ab"]);
    expect(view.search.loading()).toBe(false);
    view.dispose();
  });

  test("searching the same text again refetches", async () => {
    let attempts = 0;
    env.fetch.respond(/\/api\/search\/messages/, () => {
      attempts += 1;
      return reply([]);
    });
    const view = mount();
    view.search.search("hello");
    flush();
    await settle();
    view.search.search(" hello ");
    flush();
    await settle();
    expect(attempts).toBe(2);
    expect(view.searched).toEqual(["hello", "hello"]);
    view.dispose();
  });
});
