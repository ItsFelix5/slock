// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { createKeyedPageLoader } from "./keyedPageLoader";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

describe("createKeyedPageLoader", () => {
  test("loads different filters concurrently without dropping either", async () => {
    const everyone = deferred<string>();
    const apps = deferred<string>();
    const results: string[] = [];
    const loader = createKeyedPageLoader({
      load: (key: "apps" | "everyone") => (key === "apps" ? apps.promise : everyone.promise),
      onResult: (_key, page) => results.push(page),
    });

    const everyoneLoad = loader.load("everyone");
    const appsLoad = loader.load("apps");
    expect(loader.isLoading("everyone")).toBe(true);
    expect(loader.isLoading("apps")).toBe(true);

    apps.resolve("apps");
    everyone.resolve("everyone");
    expect(await Promise.all([everyoneLoad, appsLoad])).toEqual([true, true]);
    expect(results.sort()).toEqual(["apps", "everyone"]);
  });

  test("keeps a failed filter retryable", async () => {
    let calls = 0;
    const loader = createKeyedPageLoader({
      load: () => {
        calls++;
        return calls === 1 ? Promise.reject(new Error("offline")) : Promise.resolve("page");
      },
      onResult: () => {},
    });

    expect(await loader.load("everyone")).toBe(false);
    expect(loader.hasError("everyone")).toBe(true);
    expect(loader.hasLoaded("everyone")).toBe(false);

    expect(await loader.load("everyone")).toBe(true);
    expect(loader.hasError("everyone")).toBe(false);
    expect(loader.hasLoaded("everyone")).toBe(true);
  });
});
