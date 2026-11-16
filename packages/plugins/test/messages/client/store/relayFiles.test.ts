import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createStoreHarness, type StoreHarness, settle } from "./storeHarness";

const realXhr = globalThis.XMLHttpRequest;
let h: StoreHarness;
let uploaded: { url: string; name: string }[];
let failure: string | undefined;
let broadcasts: unknown[];

class FakeXhr {
  url = "";
  status = 200;
  responseText = "";
  upload: { onprogress?: (event: object) => void } = {};
  onload?: () => void;
  onerror?: () => void;

  open(_method: string, url: string) {
    this.url = url;
  }

  send(file: File) {
    uploaded.push({ name: file.name, url: this.url });
    this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 });
    this.status = failure ? 400 : 200;
    this.responseText = JSON.stringify(failure ? { error: failure } : {});
    this.onload?.();
  }
}

beforeEach(async () => {
  uploaded = [];
  broadcasts = [];
  failure = undefined;
  Object.defineProperty(globalThis, "XMLHttpRequest", { configurable: true, value: FakeXhr });
  h = await createStoreHarness();
  h.open("C1");
  await settle();
  const slackFetch = globalThis.fetch;
  globalThis.fetch = Object.assign(
    (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).endsWith("/messages/broadcast")) return slackFetch(input, init);
      broadcasts.push(JSON.parse(String(init?.body)));
      return Promise.resolve(Response.json({ ts: "9.9" }));
    },
    { preconnect: slackFetch.preconnect },
  );
});

afterEach(() => {
  Object.defineProperty(globalThis, "XMLHttpRequest", { configurable: true, value: realXhr });
  return h.dispose();
});

const files = () => [new File(["abc"], "a.png"), new File(["d"], "b.txt")];

describe("sending files with @channel", () => {
  test("uploads each file to the relay, then posts the message with their upload id", async () => {
    await h.store.sendFiles("C1", files(), "1.1", "<!channel> look");
    const urls = uploaded.map((upload) => new URL(upload.url, "http://x"));
    expect(urls.map((url) => [url.pathname, url.searchParams.get("filename")])).toEqual([
      ["/api/files/relay", "a.png"],
      ["/api/files/relay", "b.txt"],
    ]);
    const uploadId = urls[0]?.searchParams.get("uploadId");
    expect(uploadId).toHaveLength(36);
    expect(urls[1]?.searchParams.get("uploadId")).toBe(uploadId ?? "");
    expect(broadcasts).toEqual([{ text: "<!channel> look", threadTs: "1.1", uploadId }]);
    expect(h.messages("C1").filter((message) => message.pending)).toHaveLength(0);
  });

  test("shows why the upload failed and removes the pending message", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    failure = "This server isn't set up to send files with @channel.";
    const failed = await h.store
      .sendFiles("C1", files(), undefined, "<!channel> look")
      .catch((caught: Error) => caught.message);
    await settle();
    expect(failed).toBe(failure);
    expect(broadcasts).toEqual([]);
    expect(h.messages("C1")).toHaveLength(0);
    error.mockRestore();
  });
});

describe("sending files without a broadcast", () => {
  test("still uploads as the user", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    await h.store.sendFiles("C1", files(), undefined, "look").catch(() => {});
    expect(uploaded).toEqual([]);
    expect(h.slack.requests()).toContain("POST /api/files/reserve");
    error.mockRestore();
  });
});
