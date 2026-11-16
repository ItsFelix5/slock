import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { QueryClient } from "@tanstack/solid-query";
import { render } from "solid-js/web";

type Seen = { method: string; path: string; body?: unknown };

const realFetch = globalThis.fetch;
const disposers: (() => void)[] = [];
let seen: Seen[];
let status: { available: boolean; connected: boolean };
let failure: { error: string; status: number } | undefined;

const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(async () => {
  seen = [];
  status = { available: true, connected: false };
  failure = undefined;
  const host = createHost({ reactive: solidReactive });
  setHost(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await host.register({ id: "query", setup: (ctx) => ctx.provide("query", { client }) });
  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      seen.push({ body, method, path: String(input) });
      if (method === "PUT" && failure) {
        return Promise.resolve(Response.json({ error: failure.error }, { status: failure.status }));
      }
      if (method === "PUT") status = { ...status, connected: true };
      if (method === "DELETE") status = { ...status, connected: false };
      return Promise.resolve(Response.json(method === "GET" ? status : {}));
    },
    { preconnect: realFetch.preconnect },
  );
});

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
  globalThis.fetch = realFetch;
});

async function mountSection() {
  const { default: RelaySection } = await import("../../../src/relay/client/views/RelaySection");
  const host = document.createElement("div");
  document.body.append(host);
  disposers.push(render(() => <RelaySection />, host));
  await settle();
  return host;
}

function submit(host: HTMLElement, token: string) {
  const input = host.querySelector("input");
  if (!input) throw new Error("no token field");
  input.value = token;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  host
    .querySelector("form")
    ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  return settle();
}

const buttonLabels = (host: HTMLElement) =>
  [...host.querySelectorAll("button")].map((button) => button.textContent);

describe("RelaySection", () => {
  test("renders nothing when the server has no relay", async () => {
    status = { available: false, connected: false };
    const host = await mountSection();
    expect(host.textContent).toBe("");
  });

  test("explains how to get a token and offers a field for it", async () => {
    const host = await mountSection();
    expect(host.textContent).toContain("/slock-relay token");
    expect(host.querySelector("input")?.getAttribute("type")).toBe("password");
    expect(buttonLabels(host)).toEqual(["Connect"]);
  });

  test("connecting sends the token and switches to the connected state", async () => {
    const host = await mountSection();
    await submit(host, "slockrelay_abc.def");
    expect(seen.find((request) => request.method === "PUT")).toEqual({
      body: { token: "slockrelay_abc.def" },
      method: "PUT",
      path: "/api/relay/token",
    });
    expect(host.textContent).toContain("Connected");
    expect(host.querySelector("input")).toBeNull();
    expect(buttonLabels(host)).toEqual(["Disconnect"]);
  });

  test("shows why a token was refused and keeps the field", async () => {
    failure = { error: "invalid_token", status: 400 };
    const host = await mountSection();
    await submit(host, "slockrelay_bad.bad");
    expect(host.textContent).toContain("isn't valid or has expired");
    expect(host.querySelector("input")).not.toBeNull();
  });

  test("does not submit an empty token", async () => {
    const host = await mountSection();
    await submit(host, "   ");
    expect(seen.some((request) => request.method === "PUT")).toBe(false);
  });

  test("disconnecting brings the field back", async () => {
    status = { available: true, connected: true };
    const host = await mountSection();
    host.querySelector("button")?.click();
    await settle();
    expect(seen.some((request) => request.method === "DELETE")).toBe(true);
    expect(host.querySelector("input")).not.toBeNull();
  });
});
