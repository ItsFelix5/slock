import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { startMembers } from "./membersHarness";

let errors: ReturnType<typeof spyOn>;
beforeEach(() => {
  errors = spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => errors.mockRestore());

test("each filter loads its first page once and revisiting a loaded filter does not reload", async () => {
  const warn = spyOn(console, "warn");
  const { loads, members, settle } = await startMembers();
  expect(loads).toEqual(["everyone"]);
  members.setFilter("apps");
  await settle();
  members.setFilter("everyone");
  await settle();
  members.setFilter("apps");
  await settle();
  expect(loads).toEqual(["everyone", "apps"]);
  expect(members.filterCount("apps")).toBe(0);
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("a filter that failed to load is retried when it is selected again", async () => {
  let down = true;
  const { env, failures, members, settle } = await startMembers({
    failPage: (filter) => (filter === "apps" && down ? "internal_error" : undefined),
  });
  members.setFilter("apps");
  for (let attempt = 0; attempt < 5; attempt++) {
    await settle();
    env.advance(1_000);
  }
  expect(members.loadError()).toBe(true);
  expect(failures).toContain("Failed to load members.");
  members.setFilter("everyone");
  await settle();
  down = false;
  members.setFilter("apps");
  await settle();
  expect(members.loadError()).toBe(false);
});

test("a failed managers load shows an error that a retry clears", async () => {
  const h = await startMembers({ failManagers: true });
  h.members.setFilter("managers");
  await h.settle();
  expect(h.members.loadError()).toBe(true);
  expect(h.members.filterCount("managers")).toBeUndefined();
  h.recoverManagers();
  h.members.retryLoad();
  await h.settle();
  expect(h.members.loadError()).toBe(false);
  expect(h.members.filterCount("managers")).toBe(0);
});

test("a failed search shows an error, not an empty result, and a retry clears it", async () => {
  let down = true;
  const h = await startMembers({
    failPage: (_filter, load) => (load > 1 && down ? "no_permission" : undefined),
  });
  const search = async () => {
    h.env.advance(250);
    await h.settle();
  };
  h.members.setQuery("ana");
  await h.settle();
  expect(h.members.showSearching()).toBe(true);
  expect(h.members.showEmpty()).toBe(false);
  await search();
  expect(h.members.loadError()).toBe(true);
  expect(h.members.showEmpty()).toBe(false);
  down = false;
  h.members.retryLoad();
  await h.settle();
  expect(h.members.loadError()).toBe(false);
  expect(h.members.showEmpty()).toBe(true);
});

function listWithHeight(scrollHeight: number, clientHeight: number) {
  const list = document.createElement("div");
  Object.defineProperty(list, "scrollHeight", { value: scrollHeight });
  Object.defineProperty(list, "clientHeight", { value: clientHeight });
  return list;
}

test("keeps loading pages while the list is too short to scroll", async () => {
  const { loads } = await startMembers({ list: listWithHeight(100, 400), pages: 3 });
  expect(loads).toEqual(["everyone", "everyone", "everyone"]);
});

test("stops loading when the list is scrollable and the end is far away", async () => {
  const { loads } = await startMembers({ list: listWithHeight(2000, 400), pages: 3 });
  expect(loads).toEqual(["everyone"]);
});

test("a failed next page is not retried until asked", async () => {
  const { loads, members, settle } = await startMembers({
    failPage: (_filter, load) => (load === 2 ? "no_permission" : undefined),
    list: listWithHeight(100, 400),
    pages: 3,
  });
  expect(loads).toEqual(["everyone", "everyone"]);
  expect(members.loadError()).toBe(true);
  members.retryLoad();
  await settle();
  expect(loads).toEqual(["everyone", "everyone", "everyone"]);
  expect(members.loadError()).toBe(false);
});
