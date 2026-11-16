Bun.env.SLACK_BOT_TOKENS = JSON.stringify({ T1: "xoxb-test" });
export const { handleApi } = await import("../src/api");

export const who = { team: "T1", user: "U1" };
const realFetch = globalThis.fetch;

type Call = { method: string; params: Record<string, string> };
type Responder = (params: Record<string, string>) => object;

export let calls: Call[];
export let uploads: string[];
export let responders: Record<string, Responder>;
let uploadCount: number;

export const message = (files: string[] = []) => ({
  blocks: [{ type: "divider" }],
  bot_id: "B1",
  files: files.map((id) => ({ id })),
  text: "old",
  ts: "5.5",
  username: "felix",
});

export function installSlack() {
  calls = [];
  uploads = [];
  uploadCount = 0;
  responders = {
    "admin.roles.entity.listAssignments": () => ({
      ok: true,
      role_assignments: [{ users: ["U1"] }],
    }),
    "chat.postMessage": () => ({ ok: true, ts: "9.9" }),
    "conversations.replies": () => ({ messages: [message()], ok: true }),
    "files.getUploadURLExternal": () => {
      uploadCount++;
      return {
        file_id: `N${uploadCount}`,
        ok: true,
        upload_url: `https://files.slack.test/${uploadCount}`,
      };
    },
    "users.info": () => ({
      ok: true,
      user: { id: "U1", profile: { display_name: "felix", image_192: "https://img/felix.png" } },
    }),
  };
  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body;
      if (url.startsWith("https://files.slack.test/")) {
        const file = body instanceof FormData ? body.get("file") : undefined;
        if (file instanceof File) uploads.push(file.name);
        return Promise.resolve(new Response("ok"));
      }
      const method = url.replace("https://slack.com/api/", "");
      const params = body instanceof URLSearchParams ? Object.fromEntries(body) : {};
      calls.push({ method, params });
      return Promise.resolve(Response.json(responders[method]?.(params) ?? { ok: true }));
    },
    { preconnect: () => {} },
  );
}

export function restoreSlack() {
  globalThis.fetch = realFetch;
}

export const called = (method: string) => calls.filter((call) => call.method === method);
export const paramsOf = (method: string) => called(method)[0]?.params ?? {};

export function json(method: string, path: string, body?: object) {
  return new Request(`http://relay${path}`, {
    body: body && JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method,
  });
}

export function multipart(method: string, path: string, payload: object, names: string[]) {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  for (const name of names) form.append("files", new File([name], name));
  return new Request(`http://relay${path}`, { body: form, method });
}
