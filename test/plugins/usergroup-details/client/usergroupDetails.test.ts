import { describe, expect, test } from "bun:test";
import type { Services } from "@slock/core/types";
import { parseUserId } from "@slock/slack";
import { flush } from "solid-js";
import { createUsergroupDetails } from "../../../../packages/plugins/src/usergroup-details/client/usergroupDetails";
import { createUsergroupsSlice } from "../../../../packages/plugins/src/usergroups/client/store";
import { createFakeEnv, partialService } from "../../../support/core";
import { jsonReply, settle, startQueryHost } from "../../../support/queryHost";

async function start() {
  const env = createFakeEnv();
  await startQueryHost(
    env,
    {
      id: "services",
      setup: (ctx) => {
        ctx.provide(
          "channels",
          partialService<Services["channels"]>({ retrySections: async () => {} }),
        );
        ctx.provide("feedback", partialService<Services["feedback"]>({ caught: () => {} }));
      },
    },
    {
      id: "usergroups",
      setup: (ctx) =>
        ctx.provide(
          "usergroups",
          createUsergroupsSlice({ allUsergroupIds: () => [], selfUsergroupIds: () => [] }),
        ),
    },
  );
  const slack = { down: false, members: ["U1", "U2"], puts: [] as string[][] };
  env.fetch.respond("/api/usergroups/lookup", () =>
    jsonReply({ usergroups: { g1: { handle: "crew", id: "g1" } } }),
  );
  env.fetch.respond("/api/usergroups/g1/members", (call) => {
    if (slack.down) return jsonReply({ error: "invalid_usergroup" }, 400);
    if (call.method !== "PUT") return jsonReply({ userIds: slack.members });
    const body: { userIds: string[] } = JSON.parse(String(call.init?.body));
    slack.puts.push(body.userIds);
    slack.members = body.userIds;
    return jsonReply({});
  });
  return { details: createUsergroupDetails(), slack };
}

describe("usergroup mutations", () => {
  test("adding a member keeps the existing members", async () => {
    const { details, slack } = await start();
    await details.addUsergroupMembers("g1", [parseUserId("U3")]);
    expect(slack.puts).toEqual([["U1", "U2", "U3"]]);
  });

  test("two adds at once accumulate, and the group is pending until both land", async () => {
    const { details, slack } = await start();
    const both = Promise.all([
      details.addUsergroupMembers("g1", [parseUserId("U3")]),
      details.addUsergroupMembers("g1", [parseUserId("U4")]),
    ]);
    flush();
    expect(details.usergroupMutationPending("g1")).toBe(true);
    expect(details.usergroupMutationPending("g2")).toBe(false);
    await both;
    flush();
    expect(slack.puts.at(-1)).toEqual(["U1", "U2", "U3", "U4"]);
    expect(details.usergroupMutationPending("g1")).toBe(false);
  });

  test("removing a member keeps the others", async () => {
    const { details, slack } = await start();
    await details.removeUsergroupMember("g1", parseUserId("U1"));
    expect(slack.puts).toEqual([["U2"]]);
  });
});

describe("loading usergroup details", () => {
  test("a failed load shows an error until a retry succeeds", async () => {
    const { details, slack } = await start();
    slack.down = true;
    expect(await details.loadUsergroupDetails("g1")).toBe(false);
    await settle();
    expect(details.usergroupDetailsLoadError("g1")).toBe(true);
    slack.down = false;
    expect(await details.loadUsergroupDetails("g1")).toBe(true);
    await settle();
    expect(details.usergroupDetailsLoadError("g1")).toBe(false);
  });
});
