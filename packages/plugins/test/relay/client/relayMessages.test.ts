import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { editMessage, postBroadcastMessage, RelayError } from "../../../src/slack/client/api";

type Sent = { method: string; url: string; body: unknown };

const realFetch = globalThis.fetch;
const realXhr = globalThis.XMLHttpRequest;
let fetched: Sent[];
let uploaded: Sent[];
let progress: [number, number][];
let xhrReply: { body: object; status: number };

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
    uploaded.push({ body, method: this.method, url: this.url });
    this.upload.onprogress?.({ lengthComputable: true, loaded: 3, total: 4 });
    this.status = xhrReply.status;
    this.responseText = JSON.stringify(xhrReply.body);
    this.onload?.();
  }
}

beforeEach(() => {
  fetched = [];
  uploaded = [];
  progress = [];
  xhrReply = { body: { ts: "9.9" }, status: 200 };
  Object.defineProperty(globalThis, "XMLHttpRequest", { configurable: true, value: FakeXhr });
  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) => {
      fetched.push({ body: init?.body, method: init?.method ?? "GET", url: String(input) });
      return Promise.resolve(Response.json({ ts: "9.9" }));
    },
    { preconnect: realFetch.preconnect },
  );
});

afterEach(() => {
  globalThis.fetch = realFetch;
  Object.defineProperty(globalThis, "XMLHttpRequest", { configurable: true, value: realXhr });
});

const track = (index: number, fraction: number) => progress.push([index, fraction]);

describe("postBroadcastMessage", () => {
  test("sends json when there are no files", async () => {
    const reply = await postBroadcastMessage("C1", "<!channel> hi", [], "1.1");
    expect(reply.ts).toBe("9.9");
    expect(uploaded).toEqual([]);
    expect(fetched[0]?.url).toBe("/api/channels/C1/messages/broadcast");
    expect(JSON.parse(String(fetched[0]?.body))).toEqual({
      text: "<!channel> hi",
      threadTs: "1.1",
      unfurl: [],
    });
  });

  test("sends files as a multipart body and reports per-file progress", async () => {
    const files = [new File(["abc"], "a.png"), new File(["d"], "b.txt")];
    await postBroadcastMessage(
      "C1",
      "pics",
      undefined,
      undefined,
      [{ type: "divider" }],
      files,
      track,
    );
    expect(fetched).toEqual([]);
    const [request] = uploaded;
    expect([request?.method, request?.url]).toEqual([
      "POST",
      "/api/channels/C1/messages/broadcast",
    ]);
    const form = request?.body;
    expect(form).toBeInstanceOf(FormData);
    if (!(form instanceof FormData)) return;
    expect(JSON.parse(String(form.get("payload")))).toEqual({
      blocks: [{ type: "divider" }],
      text: "pics",
    });
    expect(form.getAll("files").map((part) => (part instanceof File ? part.name : part))).toEqual([
      "a.png",
      "b.txt",
    ]);
    expect(progress).toEqual([
      [0, 1],
      [1, 0],
    ]);
  });

  test("explains that files need a relay token", async () => {
    xhrReply = { body: { error: "relay_token_required" }, status: 400 };
    const error = await postBroadcastMessage("C1", "x", [], undefined, undefined, [
      new File(["a"], "a.png"),
    ]).catch((caught) => caught);
    expect(error).toBeInstanceOf(RelayError);
    expect(error.message).toContain("/slock-relay token");
  });

  test("keeps other errors as they are", async () => {
    xhrReply = { body: { error: "not_a_channel_manager" }, status: 502 };
    const error = await postBroadcastMessage("C1", "x", [], undefined, undefined, [
      new File(["a"], "a.png"),
    ]).catch((caught) => caught);
    expect(error).not.toBeInstanceOf(RelayError);
    expect(error.message).toBe("not_a_channel_manager");
  });
});

describe("editMessage", () => {
  test("relayed edits carry the files to keep and the new ones", async () => {
    await editMessage("C1", "5.5", "new", undefined, {
      fileIds: ["F1"],
      files: [new File(["a"], "a.png")],
      relayed: true,
    });
    const [request] = uploaded;
    expect([request?.method, request?.url]).toEqual(["PATCH", "/api/channels/C1/messages/5.5"]);
    const form = request?.body;
    if (!(form instanceof FormData)) throw new Error("expected multipart");
    expect(JSON.parse(String(form.get("payload")))).toEqual({
      fileIds: ["F1"],
      relayed: true,
      text: "new",
    });
  });

  test("relayed edits without new files are plain json", async () => {
    await editMessage("C1", "5.5", "new", undefined, { fileIds: [], relayed: true });
    expect(uploaded).toEqual([]);
    expect(fetched[0]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetched[0]?.body))).toEqual({
      fileIds: [],
      relayed: true,
      text: "new",
    });
  });

  test("ordinary edits never send the relayed flag", async () => {
    await editMessage("C1", "5.5", "new", undefined, { fileIds: ["F1"] });
    expect(JSON.parse(String(fetched[0]?.body))).toEqual({ fileIds: ["F1"], text: "new" });
  });
});
