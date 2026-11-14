import { describe, expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { createKeyedPageLoader } from "../../../src/channel-members/client/keyedPageLoader";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

function setup(load: (key: "everyone" | "apps") => Promise<string>) {
  const results: string[] = [];
  const loader = createRoot(() =>
    createKeyedPageLoader({ load, onResult: (key, page) => results.push(`${key}:${page}`) }),
  );
  return { loader, results };
}

describe("keyed page loader", () => {
  test("tracks loading then loaded and hands the page to onResult", async () => {
    const pending = deferred<string>();
    const { loader, results } = setup(() => pending.promise);
    const run = loader.load("everyone");
    expect(loader.isLoading("everyone")).toBe(true);
    expect(loader.hasLoaded("everyone")).toBe(false);
    pending.resolve("page1");
    expect(await run).toBe(true);
    expect(loader.isLoading("everyone")).toBe(false);
    expect(loader.hasLoaded("everyone")).toBe(true);
    expect(results).toEqual(["everyone:page1"]);
  });

  test("ignores a second load for the same key while one is running", async () => {
    const pending = deferred<string>();
    let calls = 0;
    const { loader } = setup(() => {
      calls++;
      return pending.promise;
    });
    const first = loader.load("everyone");
    expect(await loader.load("everyone")).toBe(false);
    pending.resolve("x");
    await first;
    expect(calls).toBe(1);
  });

  test("keys load independently", async () => {
    const everyone = deferred<string>();
    const apps = deferred<string>();
    const { loader, results } = setup((key) =>
      key === "everyone" ? everyone.promise : apps.promise,
    );
    const a = loader.load("everyone");
    const b = loader.load("apps");
    apps.resolve("apps1");
    await b;
    expect(loader.isLoading("everyone")).toBe(true);
    expect(loader.hasLoaded("apps")).toBe(true);
    everyone.resolve("e1");
    await a;
    expect(results).toEqual(["apps:apps1", "everyone:e1"]);
  });

  test("a failure marks the key as errored and a retry can succeed", async () => {
    let attempt = 0;
    const { loader, results } = setup(() => {
      attempt++;
      return attempt === 1 ? Promise.reject(new Error("boom")) : Promise.resolve("ok");
    });
    expect(await loader.load("everyone")).toBe(false);
    expect(loader.hasError("everyone")).toBe(true);
    expect(results).toEqual([]);
    expect(await loader.load("everyone")).toBe(true);
    expect(loader.hasError("everyone")).toBe(false);
    expect(loader.hasLoaded("everyone")).toBe(true);
  });

  test("an onResult failure is reported as an error instead of throwing", async () => {
    const loader = createRoot(() =>
      createKeyedPageLoader({
        load: async () => "x",
        onResult: () => {
          throw new Error("bad merge");
        },
      }),
    );
    expect(await loader.load("everyone")).toBe(false);
    expect(loader.hasError("everyone")).toBe(true);
  });
});
