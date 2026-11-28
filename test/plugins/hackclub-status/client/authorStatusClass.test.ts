import { expect, test } from "bun:test";
import { parseUserId } from "@slock/slack";
import { createRoot } from "solid-js";
import { authorStatusClass } from "../../../../packages/plugins/src/hackclub-status/client/authorStatusClass";
import { createFakeEnv } from "../../../support/core";
import { elapse, jsonReply, startQueryHost, watch } from "../../../support/queryHost";

test("a failed status lookup is retried instead of cached as no status", async () => {
  const env = createFakeEnv();
  await startQueryHost(env);
  let down = true;
  env.fetch.respond("/api/users/U1/hackclub-status", () =>
    down ? jsonReply({ error: "unavailable" }, 502) : jsonReply({ status: "eligible" }),
  );
  const id = parseUserId("U1");
  const { dispose, className } = createRoot((dispose) => ({
    className: authorStatusClass({
      user: () => ({ avatarColor: "#000", id, name: "a" }),
      userId: () => id,
      visible: () => true,
    }),
    dispose,
  }));
  let shown: string | undefined;
  const stop = watch(() => {
    shown = className();
    return shown;
  });
  await elapse(env, 1_000);
  expect(shown).toBeUndefined();
  down = false;
  await elapse(env, 30_000);
  expect(shown).toBe("hackclub-status-eligible");
  stop();
  dispose();
});
