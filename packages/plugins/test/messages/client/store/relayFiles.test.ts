import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { RelayError } from "../../../../src/slack/client/api";
import { createStoreHarness, type StoreHarness, settle } from "./storeHarness";

type Upload = { method: string; url: string; body: unknown };

const realXhr = globalThis.XMLHttpRequest;
let h: StoreHarness;
let uploads: Upload[];
let reply: { body: object; status: number };

class FakeXhr {
  method = "";
  url = "";
  status = 200;
  responseText = "";
  upload: { onprogress?: (event: object) => void } = {};
  onload?: () => void;
  onerror?: () => void;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: unknown) {
    uploads.push({ body, method: this.method, url: this.url });
    this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 });
    this.status = reply.status;
    this.responseText = JSON.stringify(reply.body);
    this.onload?.();
  }
}

beforeEach(async () => {
  uploads = [];
  reply = { body: { ts: "9.9" }, status: 200 };
  Object.defineProperty(globalThis, "XMLHttpRequest", { configurable: true, value: FakeXhr });
  h = await createStoreHarness();
  h.open("C1");
  await settle();
});

afterEach(() => {
  Object.defineProperty(globalThis, "XMLHttpRequest", { configurable: true, value: realXhr });
  return h.dispose();
});

const file = () => new File(["abc"], "a.png", { type: "image/png" });

describe("sending files with @channel", () => {
  test("goes through the relay instead of a normal upload", async () => {
    await h.store.sendFiles("C1", [file()], undefined, "<!channel> look");
    expect(uploads.map((upload) => [upload.method, upload.url])).toEqual([
      ["POST", "/api/channels/C1/messages/broadcast"],
    ]);
    const form = uploads[0]?.body;
    if (!(form instanceof FormData)) throw new Error("expected multipart");
    expect(JSON.parse(String(form.get("payload")))).toEqual({ text: "<!channel> look" });
    expect(h.slack.requests().some((request) => request.includes("/api/files/"))).toBe(false);
    expect(h.messages("C1").filter((message) => message.pending)).toHaveLength(0);
  });

  test("keeps the thread the files were sent in", async () => {
    await h.store.sendFiles("C1", [file()], "1.1", "<!here> look");
    const form = uploads[0]?.body;
    if (!(form instanceof FormData)) throw new Error("expected multipart");
    expect(JSON.parse(String(form.get("payload")))).toEqual({
      text: "<!here> look",
      threadTs: "1.1",
    });
  });

  test("removes the pending message and explains a missing relay token", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    reply = { body: { error: "relay_token_required" }, status: 400 };
    const failure = await h.store
      .sendFiles("C1", [file()], undefined, "<!channel> look")
      .catch((caught) => caught);
    await settle();
    expect(failure).toBeInstanceOf(RelayError);
    expect(h.messages("C1")).toHaveLength(0);
    error.mockRestore();
  });
});

describe("sending files without a broadcast", () => {
  test("still uploads as the user", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    await h.store.sendFiles("C1", [file()], undefined, "look").catch(() => {});
    expect(uploads).toEqual([]);
    expect(h.slack.requests()).toContain("POST /api/files/reserve");
    error.mockRestore();
  });
});
