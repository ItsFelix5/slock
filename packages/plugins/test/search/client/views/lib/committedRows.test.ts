import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv, int, pick, seededRandom } from "@slock/core/testing";
import { createDebouncedSearch } from "@slock/ui";
import { createMemo, createRoot, createSignal, flush } from "solid-js";
import {
  createCommittedRows,
  firstResultIndex,
  MESSAGE_SEARCH_INDEX,
} from "../../../../../src/search/client/views/lib/committedRows";

type Pending = { query: string; resolve: (rows: string[]) => void; reject: () => void };

let host: ReturnType<typeof createHost>;

beforeEach(async () => {
  host = createHost({ env: createFakeEnv(), reactive: solidReactive });
  setHost(host);
  await host.register();
});
afterEach(() => host.stop());

async function settle() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  flush();
}

function harness() {
  const pending: Pending[] = [];
  const selected: number[] = [];
  const submitted: number[] = [];
  const dispose: (() => void)[] = [];
  const view = createRoot((stop) => {
    dispose.push(stop);
    const [query, setQuery] = createSignal("");
    const [late, setRemote] = createSignal<string[]>();
    const [local, setLocal] = createSignal<string[]>([]);
    const search = createDebouncedSearch<string[]>({
      delay: 100,
      empty: [],
      search: (text) =>
        new Promise<string[]>((resolve, reject) =>
          pending.push({ query: text, reject: () => reject(new Error("failed")), resolve }),
        ),
    });
    const remote = () => late() ?? search.value();
    const ranked = createMemo(() => [...local(), ...remote()].sort());
    const hasQuery = () => !!query().trim();
    const committed = createCommittedRows({
      hasQuery,
      onCommit: (index) => selected.push(index),
      onSubmit: (index) => submitted.push(index),
      ranked,
      searching: search.searching,
    });
    const type = (value: string) => {
      setQuery(value);
      setRemote(undefined);
      committed.restart();
      search.set(value, true);
      flush();
    };
    return {
      committed,
      local,
      query,
      ranked,
      remote,
      searching: search.searching,
      setLocal,
      setRemote,
      type,
    };
  });
  return { dispose: dispose[0] as () => void, pending, selected, submitted, view };
}

describe("firstResultIndex", () => {
  test("the message search row is a fallback, the first result wins when there is one", () => {
    expect(MESSAGE_SEARCH_INDEX).toBe(0);
    expect(firstResultIndex(0)).toBe(0);
    expect(firstResultIndex(1)).toBe(1);
    expect(firstResultIndex(30)).toBe(1);
  });
});

describe("frozen snapshot", () => {
  test("nothing is shown while the remote search is pending", () => {
    const { view, selected } = harness();
    view.setLocal(["alpha"]);
    view.type("a");
    expect(view.committed.rows()).toEqual([]);
    expect(selected).toEqual([]);
  });

  test("commits the ranked rows once the search settles and selects the first result", async () => {
    const { view, pending, selected } = harness();
    view.setLocal(["alpha"]);
    view.type("a");
    pending[0]?.resolve(["beta"]);
    await settle();
    expect(view.committed.rows()).toEqual(["alpha", "beta"]);
    expect(selected).toEqual([1]);
  });

  test("late local sources never move committed rows", async () => {
    const { view, pending, selected } = harness();
    view.type("a");
    pending[0]?.resolve(["beta"]);
    await settle();
    const committed = view.committed.rows();
    view.setLocal(["aardvark"]);
    view.setRemote(["zeta"]);
    flush();
    expect(view.committed.rows()).toBe(committed);
    expect(view.ranked()).toEqual(["aardvark", "zeta"]);
    expect(selected).toEqual([1]);
  });

  test("a stale response arriving after a newer one is ignored", async () => {
    const { view, pending, selected } = harness();
    view.type("a");
    view.type("ab");
    pending[1]?.resolve(["fresh"]);
    await settle();
    expect(view.committed.rows()).toEqual(["fresh"]);
    pending[0]?.resolve(["stale"]);
    await settle();
    expect(view.committed.rows()).toEqual(["fresh"]);
    expect(selected).toEqual([1]);
  });

  test("a stale response arriving while the newer one is pending changes nothing", async () => {
    const { view, pending } = harness();
    view.type("a");
    view.type("ab");
    pending[0]?.resolve(["stale"]);
    await settle();
    expect(view.committed.rows()).toEqual([]);
    expect(view.searching()).toBe(true);
    pending[1]?.resolve(["fresh"]);
    await settle();
    expect(view.committed.rows()).toEqual(["fresh"]);
  });

  test("typing again drops the old rows right away", async () => {
    const { view, pending } = harness();
    view.type("a");
    pending[0]?.resolve(["beta"]);
    await settle();
    view.type("ab");
    expect(view.committed.rows()).toEqual([]);
  });

  test("a failed search still commits the local rows", async () => {
    const { view, pending, selected } = harness();
    view.setLocal(["alpha"]);
    view.type("a");
    pending[0]?.reject();
    await settle();
    expect(view.committed.rows()).toEqual(["alpha"]);
    expect(selected).toEqual([1]);
  });

  test("no matches selects the message search row", async () => {
    const { view, pending, selected } = harness();
    view.type("zzz");
    pending[0]?.resolve([]);
    await settle();
    expect(view.committed.rows()).toEqual([]);
    expect(selected).toEqual([0]);
  });

  test("an empty query commits nothing", () => {
    const { view, selected } = harness();
    view.type("   ");
    expect(view.committed.rows()).toEqual([]);
    expect(selected).toEqual([]);
  });
});

describe("submit", () => {
  test("enter while pending waits and then opens the best match", async () => {
    const { view, pending, submitted } = harness();
    view.type("a");
    view.committed.submit(0);
    expect(submitted).toEqual([]);
    pending[0]?.resolve(["beta"]);
    await settle();
    expect(submitted).toEqual([1]);
  });

  test("enter while pending with no matches opens message search", async () => {
    const { view, pending, submitted } = harness();
    view.type("zzz");
    view.committed.submit(0);
    pending[0]?.resolve([]);
    await settle();
    expect(submitted).toEqual([0]);
  });

  test("a queued enter fires once", async () => {
    const { view, pending, submitted } = harness();
    view.type("a");
    view.committed.submit(0);
    pending[0]?.resolve(["beta"]);
    await settle();
    view.setLocal(["alpha"]);
    expect(submitted).toEqual([1]);
  });

  test("typing after enter cancels the queued submit", async () => {
    const { view, pending, submitted } = harness();
    view.type("a");
    view.committed.submit(0);
    view.type("ab");
    pending[1]?.resolve(["beta"]);
    await settle();
    expect(submitted).toEqual([]);
  });

  test("enter after commit opens the active row", async () => {
    const { view, pending, submitted } = harness();
    view.type("a");
    pending[0]?.resolve(["beta", "gamma"]);
    await settle();
    view.committed.submit(2);
    view.committed.submit(0);
    view.committed.submit(null);
    expect(submitted).toEqual([2, 0]);
  });
});

describe("invariant", () => {
  const words = ["a", "ab", "abc", "b", "bc"];
  const actions = ["type", "resolve", "reject", "local", "remote"] as const;

  test("rows only change on commit or restart, whatever order sources arrive in", async () => {
    for (let seed = 1; seed <= 100; seed++) {
      const random = seededRandom(seed);
      const { view, pending, selected } = harness();
      let seen = view.committed.rows();
      const steps = int(random, 3, 25);
      for (let step = 0; step < steps; step++) {
        const action = pick(random, actions);
        const word = pick(random, words);
        const commitsBefore = selected.length;
        if (action === "type") view.type(word);
        else if (action === "local") view.setLocal([word]);
        else if (action === "remote") view.setRemote([word, word]);
        else if (action === "resolve") pending[int(random, 0, pending.length)]?.resolve([word]);
        else pending[int(random, 0, pending.length)]?.reject();
        await settle();
        const rows = view.committed.rows();
        const committed = selected.length > commitsBefore;
        if (rows !== seen) expect(committed || action === "type").toBe(true);
        seen = rows;
      }
    }
  });

  test("committed rows always equal what the ranking showed when the search settled", async () => {
    for (let seed = 1; seed <= 100; seed++) {
      const random = seededRandom(seed);
      const { view, pending } = harness();
      view.setLocal([pick(random, words)]);
      view.type(pick(random, words));

      const order = Array.from({ length: pending.length }, (_, i) => i).sort(() => random() - 0.5);
      for (const index of order) pending[index]?.resolve([pick(random, words)]);
      await settle();
      expect(view.committed.rows()).toEqual(view.ranked());
    }
  });
});
