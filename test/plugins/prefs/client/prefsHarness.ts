import type { Services } from "@slock/core/types";
import { defineQuery } from "@slock/plugins/query/client/api";
import type { UserPrefs } from "@slock/types";
import { createRoot, flush } from "solid-js";
import { createFakeEnv, partialService } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";

export const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
    flush();
  }
};

const userPrefsQuery = defineQuery<null, UserPrefs>({
  load: () => new Promise<UserPrefs>(() => {}),
  name: "testUserPrefs",
});

export async function startPrefs(env = createFakeEnv(1, 1_000_000), initial?: UserPrefs) {
  const errors: string[] = [];
  const undos: string[] = [];
  const host = await startQueryHost(env);
  await host.register({
    id: "feedback",
    setup: (ctx) =>
      ctx.provide(
        "feedback",
        partialService<Services["feedback"]>({
          error: (_key, message) => errors.push(message),
          undo: {
            push: ({ label }) => void undos.push(label),
            undo: () => Promise.resolve(undefined),
          },
        }),
      ),
  });
  const { createPrefsStore } = await import("../../../../packages/plugins/src/prefs/client/store");
  if (initial) userPrefsQuery.set(null, initial);
  const store = createRoot(() => {
    const loaded = userPrefsQuery.state(() => null);
    return createPrefsStore({
      overlayUserPrefs: (change) => userPrefsQuery.overlay(null, change),
      userPrefs: () => loaded().data,
    });
  });
  await settle();
  const load = async (prefs: UserPrefs) => {
    userPrefsQuery.set(null, prefs);
    await settle();
  };
  return { env, errors, load, store, undos };
}
