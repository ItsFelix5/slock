// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, mock, test } from "bun:test";
import type { LinkPreview } from "@slock/slack-api";
import { settleLinkPreview } from "../lib/linkPreviews";

describe("settleLinkPreview", () => {
  test("settles failures without rejecting and evicts the retryable placeholder", async () => {
    const url = "https://example.com/article";
    const preview: LinkPreview = { title: "Example", url };
    let attempt = 0;
    const fetchPreview = mock(() => {
      attempt++;
      return attempt === 1 ? Promise.reject(new Error("network down")) : Promise.resolve(preview);
    });
    let cache: Record<string, LinkPreview | null> = { [url]: null };
    const update = (updater: (current: typeof cache) => typeof cache) => {
      cache = updater(cache);
    };

    await settleLinkPreview(url, fetchPreview, () => true, update);
    expect(fetchPreview).toHaveBeenCalledTimes(1);
    expect(cache).toEqual({});

    cache = { [url]: null };
    await settleLinkPreview(url, fetchPreview, () => true, update);

    expect(fetchPreview).toHaveBeenCalledTimes(2);
    expect(cache).toEqual({ [url]: preview });
  });

  test("a stale failure cannot delete a newer preview", async () => {
    const url = "https://example.com/article";
    const preview: LinkPreview = { title: "Newer result", url };
    let cache: Record<string, LinkPreview | null> = { [url]: preview };

    await settleLinkPreview(
      url,
      () => Promise.reject(new Error("old request failed")),
      () => false,
      (updater) => {
        cache = updater(cache);
      },
    );

    expect(cache).toEqual({ [url]: preview });
  });
});
