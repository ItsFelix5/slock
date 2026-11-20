import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv } from "@slock/core/testing";
import type { AccountSummary } from "@slock/types";
import {
  forceReauth,
  getActiveAccountId,
  getCachedWorkspaceDomain,
  getCachedWorkspaceId,
  isConfigured,
  listAccounts,
  REAUTH_EVENT,
  refreshAccountInfo,
  switchAccount,
  userProfileUrl,
} from "../../src/session/account";
import { sessionInfoCookie } from "../../src/session/info";
import { tid, uid } from "../../src/testing";

const accounts: AccountSummary[] = [
  { domain: "one.slack.com", id: "a", name: "One", teamId: tid("T1") },
  { domain: "two.enterprise.slack.com", id: "b", name: "Two", teamId: null },
];

const GLOBAL_NAMES = ["document", "window"];

function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
}

let jar = "";
let events: string[] = [];
let deleted: string[] = [];
const realGlobals = GLOBAL_NAMES.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));

beforeEach(() => {
  jar = "";
  events = [];
  deleted = [];
  setGlobal("document", {
    get cookie() {
      return jar;
    },
    set cookie(value: string) {
      jar = value;
    },
  });
  setGlobal("window", { dispatchEvent: (event: Event) => events.push(event.type) });
  const env = createFakeEnv();
  env.fetch.respond(
    () => true,
    (call) => {
      deleted.push(`${call.method} ${call.url}`);
      return new Response("{}");
    },
  );
  setHost(createHost({ env, reactive: solidReactive }));
  refreshAccountInfo();
});

afterEach(() => {
  GLOBAL_NAMES.forEach((name, index) => {
    const descriptor = realGlobals[index];
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  });
});

function signIn(id: string | null) {
  jar = sessionInfoCookie({ accounts, id });
  refreshAccountInfo();
}

describe("account info", () => {
  test("is unconfigured without a cookie", () => {
    expect(isConfigured()).toBe(false);
    expect(listAccounts()).toEqual([]);
    expect(getActiveAccountId()).toBeNull();
    expect(getCachedWorkspaceId()).toBeNull();
    expect(getCachedWorkspaceDomain()).toBeNull();
  });

  test("reads the active account from the cookie", () => {
    signIn("a");
    expect(isConfigured()).toBe(true);
    expect(getActiveAccountId()).toBe("a");
    expect(getCachedWorkspaceId()).toBe(tid("T1"));
    expect(getCachedWorkspaceDomain()).toBe("one.slack.com");
    expect(listAccounts()).toEqual(accounts);
  });

  test("accounts without an active id are not configured", () => {
    signIn(null);
    expect(isConfigured()).toBe(false);
    expect(listAccounts()).toEqual(accounts);
  });

  test("the cookie is cached until refreshed", () => {
    signIn("a");
    expect(getActiveAccountId()).toBe("a");
    jar = sessionInfoCookie({ accounts, id: "b" });
    expect(getActiveAccountId()).toBe("a");
    refreshAccountInfo();
    expect(getActiveAccountId()).toBe("b");
  });

  test("switchAccount rewrites the cookie and drops the cache", () => {
    signIn("a");
    switchAccount("b");
    expect(getActiveAccountId()).toBe("b");
    expect(getCachedWorkspaceId()).toBeNull();
  });

  test("switchAccount does nothing without a session", () => {
    switchAccount("b");
    expect(jar).toBe("");
  });

  test("a garbage cookie counts as signed out", () => {
    jar = "slock_info=%7Bnope";
    expect(isConfigured()).toBe(false);
  });
});

describe("userProfileUrl", () => {
  test.each([
    ["acme.slack.com", "https://acme.enterprise.slack.com/team/U1"],
    ["acme.enterprise.slack.com", "https://acme.enterprise.slack.com/team/U1"],
  ])("%s", (domain, expected) => {
    expect(userProfileUrl(domain, uid("U1"))).toBe(expected);
  });
});

describe("forceReauth", () => {
  test("deletes the session, signals the app and never settles", async () => {
    signIn("a");
    let settled = false;
    forceReauth().finally(() => {
      settled = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(deleted).toEqual(["DELETE /api/session/a"]);
    expect(events).toEqual([REAUTH_EVENT]);
    expect(settled).toBe(false);
  });

  test("still signals when nobody is signed in", async () => {
    forceReauth();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(deleted).toEqual([]);
    expect(events).toEqual([REAUTH_EVENT]);
  });
});
