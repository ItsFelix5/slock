import type { Services } from "@slock/core/types";
import type { User, UserProfile } from "@slock/types";
import { createRoot, createSignal, flush } from "solid-js";
import type { UsersApi } from "../../../../packages/plugins/src/users/client/store/usersApi";
import { networkError } from "../../../../packages/slack/src/error";
import { createFakeEnv, partialService } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";
import { uid } from "../../../support/slack";

export const offline = () => networkError(new Error("down"));

export const user = (id: string, name = id.toLowerCase(), extra: Partial<User> = {}): User => ({
  avatarColor: "#000",
  id: uid(id),
  name,
  ...extra,
});

export const ME = user("U1", "me");

type Behaviour = {
  fetchUser?: (id: string) => Promise<User | null>;
  fetchUserProfile?: (id: string) => Promise<UserProfile>;
  fetchUserPresence?: (id: string) => Promise<"active" | "away" | null>;
  searchDirectory?: (query: string) => Promise<{ users: User[]; truncated: boolean }>;
  setPresence?: () => Promise<void>;
  setStatus?: () => Promise<void>;
};

export async function startUsers(behaviour: Behaviour = {}) {
  const calls: Record<"fetchUser" | "fetchUserPresence" | "fetchUserProfile", string[]> = {
    fetchUser: [],
    fetchUserPresence: [],
    fetchUserProfile: [],
  };
  const flashes: string[] = [];
  const api = partialService<UsersApi>({
    fetchUser: (id) => {
      calls.fetchUser.push(id);
      return (behaviour.fetchUser ?? (() => Promise.resolve(null)))(id);
    },
    fetchUserPresence: (id) => {
      calls.fetchUserPresence.push(id);
      return (behaviour.fetchUserPresence ?? (() => Promise.resolve(null)))(id);
    },
    fetchUserProfile: (id) => {
      calls.fetchUserProfile.push(id);
      return (behaviour.fetchUserProfile ?? (() => Promise.resolve({})))(id);
    },
    setProfileFields: () => Promise.resolve(),
    searchDirectory:
      behaviour.searchDirectory ?? (() => Promise.resolve({ truncated: false, users: [] })),
    setPresence: behaviour.setPresence ?? (() => Promise.resolve()),
    setStatus: behaviour.setStatus ?? (() => Promise.resolve()),
  });
  const env = createFakeEnv();
  await startQueryHost(env, {
    id: "feedback",
    setup: (ctx) =>
      ctx.provide(
        "feedback",
        partialService<Services["feedback"]>({
          error: () => {},
          flash: (_key, message) => flashes.push(message),
        }),
      ),
  });
  const { createUsersStore } = await import("../../../../packages/plugins/src/users/client/store");
  const [online, setOnline] = createSignal(true);
  const store = createRoot(() =>
    createUsersStore(
      {
        currentUserBase: () => ME,
        isSelfOnline: online,
        panes: partialService<Services["shell.panes"]>({
          closePane: () => {},
          openInNewPane: () => "pane",
          panes: () => [],
        }),
      },
      api,
    ),
  );
  flush();
  return { calls, env, flashes, setOnline, store };
}
