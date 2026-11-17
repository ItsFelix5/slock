import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createStoreHarness, type StoreHarness, settle } from "./storeHarness";

const realXhr = globalThis.XMLHttpRequest;
let h: StoreHarness;
let uploaded: string[];
let reservations: unknown[];
let broadcasts: unknown[];
let noRelay: boolean;

class FakeXhr {
  url = "";
  status = 200;
  responseText = "{}";
  upload: { onprogress?: (event: object) => void } = {};
  onload?: () => void;
  onerror?: () => void;

  open(_method: string, url: string) {
    this.url = url;
  }

  send() {
    uploaded.push(this.url);
    this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 });
    this.onload?.();
  }
}

beforeEach(async () => {
  uploaded = [];
  reservations = [];
  broadcasts = [];
  noRelay = false;
  Object.defineProperty(globalThis, "XMLHttpRequest", { configurable: true, value: FakeXhr });
  h = await createStoreHarness();
  h.open("C1");
  await settle();
  const slackFetch = globalThis.fetch;
  globalThis.fetch = Object.assign(
    (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/files/relay-reserve") {
        reservations.push(JSON.parse(String(init?.body)));
        return Promise.resolve(
          noRelay
            ? Response.json(
                { error: "This server isn't set up to send files with @channel." },
                { status: 400 },
              )
            : Response.json({
                file_id: `R${reservations.length}`,
                upload_url: `https://files.slack.com/u${reservations.length}`,
              }),
        );
      }
      if (!url.endsWith("/messages/broadcast")) return slackFetch(input, init);
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
  test("uploads through the client with relay reservations, then sends the ids", async () => {
    await h.store.sendFiles("C1", files(), "1.1", "<!channel> look");
    expect(reservations).toEqual([
      { filename: "a.png", length: "3" },
      { filename: "b.txt", length: "1" },
    ]);
    expect(uploaded.map((url) => new URL(url, "http://x").searchParams.get("url"))).toEqual([
      "https://files.slack.com/u1",
      "https://files.slack.com/u2",
    ]);
    expect(broadcasts).toEqual([
      {
        files: [
          { id: "R1", title: "a.png" },
          { id: "R2", title: "b.txt" },
        ],
        text: "<!channel> look",
        threadTs: "1.1",
      },
    ]);
    expect(h.slack.requests()).not.toContain("POST /api/files/reserve");
    expect(h.messages("C1").filter((message) => message.pending)).toHaveLength(0);
  });

  test("shows why it failed and removes the pending message", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    noRelay = true;
    const failed = await h.store
      .sendFiles("C1", files(), undefined, "<!channel> look")
      .catch((caught: Error) => caught.message);
    await settle();
    expect(failed).toBe("This server isn't set up to send files with @channel.");
    expect(uploaded).toEqual([]);
    expect(broadcasts).toEqual([]);
    expect(h.messages("C1")).toHaveLength(0);
    error.mockRestore();
  });
});

describe("sending files without a broadcast", () => {
  test("still uploads as the user", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    await h.store.sendFiles("C1", files(), undefined, "look").catch(() => {});
    expect(reservations).toEqual([]);
    expect(h.slack.requests()).toContain("POST /api/files/reserve");
    error.mockRestore();
  });
});
