import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHost, defined, type PluginDef } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { getActiveAccountId, REAUTH_EVENT, sessionInfoCookie } from "@slock/slack";
import { tid } from "@slock/slack/testing";
import type { AccountSummary } from "@slock/types";
import type { AccountService } from "../../../src/account/client/api";
import account from "../../../src/account/client/index";

type Host = ReturnType<typeof createHost>;

const accounts: AccountSummary[] = [
  { domain: "one.slack.com", id: "a", name: "One", teamId: tid("T1") },
  { domain: "two.slack.com", id: "b", name: "Two", teamId: tid("T2") },
];

function signIn(id: string | null) {
  document.cookie = sessionInfoCookie({ accounts, id });
}

function workspacePlugin(log: string[]): PluginDef {
  return {
    id: "workspace",
    requires: ["account"],
    setup: (ctx) => {
      const session = { id: getActiveAccountId(), messages: [] as string[] };
      log.push(`start:${session.id}`);
      ctx.provide("workspaceSession", session);
      ctx.onCleanup(() => {
        session.messages.length = 0;
        log.push(`stop:${session.id}`);
      });
    },
  };
}

declare module "@slock/core/types" {
  interface Services {
    workspaceSession: { id: string | null; messages: string[] };
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const restartAccount = () =>
  defined(host.service("account") as AccountService | undefined).restart();
const session = () => defined(host.service("workspaceSession"));

let host: Host;
let log: string[];

async function boot() {
  log = [];
  host = createHost({ reactive: solidReactive });
  setHost(host);
  await host.register({ id: "account", setup: account }, workspacePlugin(log));
}

beforeEach(() => signIn("a"));

afterEach(async () => {
  await host.stop();
  document.cookie = "slock_session=; Max-Age=0; Path=/";
});

describe("account switching", () => {
  test("the new account starts from a fresh session and the old one is released", async () => {
    await boot();
    const first = session();
    first.messages.push("secret from a");
    signIn("b");
    await restartAccount();
    const second = session();
    expect(log).toEqual(["start:a", "stop:a", "start:b"]);
    expect(second).not.toBe(first);
    expect(second.id).toBe("b");
    expect(second.messages).toEqual([]);
    expect(first.messages).toEqual([]);
  });

  test("restart returns the url to the root", async () => {
    await boot();
    history.replaceState(null, "", "/C123/C456");
    await restartAccount();
    expect(window.location.pathname).toBe("/");
  });

  test("a reauth event restarts the whole host once", async () => {
    await boot();
    window.dispatchEvent(new MessageEvent(REAUTH_EVENT));
    await settle();
    expect(log).toEqual(["start:a", "stop:a", "start:a"]);
  });

  test("restarting repeatedly never stacks reauth listeners", async () => {
    await boot();
    for (let i = 0; i < 4; i++) await restartAccount();
    log.length = 0;
    window.dispatchEvent(new MessageEvent(REAUTH_EVENT));
    await settle();
    expect(log).toEqual(["stop:a", "start:a"]);
  });

  test("a stopped host ignores reauth events", async () => {
    await boot();
    await host.stop();
    log.length = 0;
    window.dispatchEvent(new MessageEvent(REAUTH_EVENT));
    await settle();
    expect(log).toEqual([]);
  });
});
