import { describe, expect, test } from "bun:test";
import { createHost } from "../src/host/host";

function states(host: ReturnType<typeof createHost>) {
  return Object.fromEntries(host.list().map(({ id, status }) => [id, status.state]));
}

describe("list", () => {
  test("reports manifest fields, transitive dependents and enabled state", async () => {
    const host = createHost();
    await host.register(
      { core: true, id: "a", name: "Alpha", setup: () => {} },
      { hidden: true, id: "b", requires: ["a"], setup: () => {} },
      { defaultEnabled: false, id: "c", requires: ["b"], setup: () => {} },
    );
    const byId = Object.fromEntries(host.list().map((info) => [info.id, info]));
    expect(byId.a).toMatchObject({
      core: true,
      dependents: ["b", "c"],
      enabled: true,
      name: "Alpha",
    });
    expect(byId.b).toMatchObject({ core: false, dependents: ["c"], hidden: true, name: "b" });
    expect(byId.c).toMatchObject({ dependents: [], enabled: false, requires: ["b"] });
  });

  test("dependents terminates on a cycle", async () => {
    const host = createHost();
    await host.register(
      { id: "a", requires: ["b"], setup: () => {} },
      { id: "b", requires: ["a"], setup: () => {} },
    );
    expect(host.list().map((info) => info.dependents)).toEqual([
      ["a", "b"],
      ["a", "b"],
    ]);
  });
});

describe("enabled store", () => {
  test("starts from the stored overrides and writes the full map on change", async () => {
    const writes: Record<string, boolean>[] = [];
    const host = createHost({
      enabled: {
        read: () => ({ one: false }),
        write: (overrides) => {
          writes.push(overrides);
          return true;
        },
      },
    });
    await host.register({ id: "one", setup: () => {} }, { id: "two", setup: () => {} });
    expect(states(host)).toEqual({ one: "off", two: "running" });
    await host.setEnabled("two", false);
    await host.setEnabled("one", true);
    expect(writes).toEqual([
      { one: false, two: false },
      { one: true, two: false },
    ]);
    expect(states(host)).toEqual({ one: "running", two: "off" });
  });

  test("an override for a plugin that is not registered yet still applies", async () => {
    const host = createHost({ enabled: { read: () => ({}), write: () => true } });
    await host.setEnabled("later", false);
    await host.register({ id: "later", setup: () => {} });
    expect(states(host)).toEqual({ later: "off" });
  });
});
