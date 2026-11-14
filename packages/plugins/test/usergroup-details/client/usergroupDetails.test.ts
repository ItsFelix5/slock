import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Host } from "@slock/core";
import { setHost } from "@slock/core/solid";
import { createUsergroupDetails } from "../../../src/usergroup-details/client/usergroupDetails";

const originalFetch = globalThis.fetch;
let members: string[];
let putBodies: string[][];

function json(body: object) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function fakeSlack() {
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const body: { userIds: string[] } = JSON.parse(String(init.body));
      putBodies.push(body.userIds);
      members = body.userIds;
    }
    return Promise.resolve(json({ ok: true }));
  }) as typeof fetch;
}

beforeEach(() => {
  members = ["u1", "u2"];
  putBodies = [];
  fakeSlack();
  const services: Record<string, unknown> = {
    channels: { retrySections: async () => {} },
    feedback: { caught: () => {} },
    "shell.panes": { panes: () => [] },
    usergroups: {
      refreshUsergroupDetails: async () => ({ memberIds: [...members], channelIds: [] }),
    },
  };
  setHost({ service: (key: string) => services[key] } as unknown as Host);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("usergroup mutations", () => {
  test("adding a member keeps the existing members", async () => {
    await createUsergroupDetails().addUsergroupMembers("g1", ["u3"]);
    expect(putBodies[0]).toEqual(["u1", "u2", "u3"]);
  });

  test("two adds in a row accumulate", async () => {
    const details = createUsergroupDetails();
    await details.addUsergroupMembers("g1", ["u3"]);
    await details.addUsergroupMembers("g1", ["u4"]);
    expect(putBodies.at(-1)).toEqual(["u1", "u2", "u3", "u4"]);
  });

  test("removing a member keeps the others", async () => {
    await createUsergroupDetails().removeUsergroupMember("g1", "u1");
    expect(putBodies[0]).toEqual(["u2"]);
  });
});
