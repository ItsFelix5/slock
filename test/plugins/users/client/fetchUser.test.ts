import { expect, test } from "bun:test";
import { fetchUser } from "../../../../packages/plugins/src/users/client/requests";
import { createFakeEnv } from "../../../support/core";
import { jsonReply, startQueryHost } from "../../../support/queryHost";

test("a bot Slack does not know is a missing user, another error is a failure", async () => {
  const env = createFakeEnv();
  await startQueryHost(env);
  env.fetch.respond("/api/bots/BGONE", () => jsonReply({ error: "bot_not_found" }, 404));
  env.fetch.respond("/api/bots/BDOWN", () => jsonReply({ error: "internal_error" }, 500));
  expect(await fetchUser("BGONE")).toBeNull();
  await expect(fetchUser("BDOWN")).rejects.toThrow("internal_error");
});
