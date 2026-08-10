// biome-ignore-all lint/style/noExcessiveLinesPerFile: One cohesive user entity slice with shared profile/presence state.
import type { User, UserCustomField } from "@slock/slack-api";
import {
  setPresence as apiSetPresence,
  setProfileFields as apiSetProfileFields,
  setStatus as apiSetStatus,
  fetchAppDescription,
  fetchUser,
  fetchUserCustomFields,
  fetchUserPresence,
  searchDirectory,
} from "@slock/slack-api";
import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { createSerialMutationQueue } from "../../mutations/serialMutationQueue";
import { actionFeedback } from "../feedback";

type UsersApi = {
  fetchAppDescription: typeof fetchAppDescription;
  fetchUser: typeof fetchUser;
  fetchUserCustomFields: typeof fetchUserCustomFields;
  fetchUserPresence: typeof fetchUserPresence;
  searchDirectory: typeof searchDirectory;
  setPresence: typeof apiSetPresence;
  setProfileFields: typeof apiSetProfileFields;
  setStatus: typeof apiSetStatus;
};

const DEFAULT_USERS_API: UsersApi = {
  fetchAppDescription,
  fetchUser,
  fetchUserCustomFields,
  fetchUserPresence,
  searchDirectory,
  setPresence: apiSetPresence,
  setProfileFields: apiSetProfileFields,
  setStatus: apiSetStatus,
};

export function createUsersSlice(
  deps: { currentUserBase: () => User | undefined },
  api: UsersApi = DEFAULT_USERS_API,
) {
  const [extraUsers, setExtraUsers] = createStore<Record<string, User>>({});
  const pendingUsers = new Set<string>();
  const [presenceOverrides, setPresenceOverrides] = createStore<Record<string, "active" | "away">>(
    {},
  );
  const [selfStatusOverride, setSelfStatusOverride] = createSignal<Partial<User> | null>(null);
  const [profileUserId, setProfileUserId] = createSignal<string | null>(null);
  // Keyed by app id (not user id) — every bot user of the same app shares one
  // description, so this dedupes the apps.profile.get fetch across them.
  const [botBios, setBotBios] = createStore<Record<string, string>>({});
  const pendingBotBios = new Set<string>();

  // Custom profile field *values* aren't in the batched users/info lookup for anyone, self
  // included — only users.profile.get has them, fetched lazily per id here rather than
  // merged into the hot userById/currentUser paths that every avatar/mention hydration uses.
  const [customFieldsById, setCustomFieldsById] = createStore<
    Record<string, UserCustomField[] | undefined>
  >({});
  const loadedCustomFields = new Set<string>();
  const pendingCustomFields = new Set<string>();

  // Every user ever resolved this session — via userById's lazy fetchUser,
  // searchUsers' remote matches, or an invalidateUser refresh. There's no bootstrap
  // user list to seed this from (a fixed-size slice of the org is never complete),
  // so it starts empty and fills in as the UI asks about people.
  function knownUsers(): User[] {
    return Object.values(extraUsers);
  }

  function cacheUsers(users: User[]): void {
    for (const user of users) setExtraUsers(user.id, user);
  }

  function userById(id: string): User | undefined {
    // "" is mappers.ts's sentinel for a message with neither a user nor a
    // bot_id (plain system messages) — not a ghost id worth round-tripping
    // through fetchUser.
    if (!id) return;
    // Self goes through currentUser() — the generic lookup below never carries a real presence value.
    if (id === deps.currentUserBase()?.id) return currentUser();
    const known = extraUsers[id];
    if (!known) {
      if (!pendingUsers.has(id)) {
        pendingUsers.add(id);
        api
          .fetchUser(id)
          .then((user) => {
            if (user) setExtraUsers(id, user);
            else console.warn("[userById] fetchUser resolved no user for id", JSON.stringify(id));
          })
          .catch((err) =>
            console.warn("[userById] fetchUser threw for id", JSON.stringify(id), err),
          )
          .finally(() => {
            pendingUsers.delete(id);
          });
      }
      return;
    }
    const presence = presenceOverrides[id];
    if (!presence) return known;
    return { ...known, presence };
  }

  // The gateway sends this when a user's profile changes elsewhere (name, avatar,
  // status, etc.) — our cached extraUsers entry is now stale. Just drop it rather
  // than eagerly re-fetching; userById already lazily re-fetches on demand next
  // time it's actually needed, same as any other never-seen id.
  function invalidateUser(id: string) {
    setExtraUsers(
      produce((s) => {
        delete s[id];
      }),
    );
    pendingUsers.delete(id);
  }

  // Org-wide people search for DM compose / @mention / global search. On a large
  // workspace (Hack Club's is ~100k members) there's no local slice worth trusting
  // as complete, so this merges instantly-available local matches (anyone already
  // resolved via userById/a prior search) with a live search.modules.people query
  // (see searchDirectory).
  async function searchUsers(query: string, excludeId?: string): Promise<User[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const local = new Map<string, User>();
    for (const id of Object.keys(extraUsers)) local.set(id, extraUsers[id]);
    const localMatches = [...local.values()].filter(
      (u) => u.id !== excludeId && u.name.toLowerCase().includes(q),
    );

    const { users: remote } = await api.searchDirectory(q);
    for (const u of remote) {
      if (!local.has(u.id)) setExtraUsers(u.id, u);
    }

    const merged = new Map<string, User>();
    for (const u of localMatches) merged.set(u.id, u);
    for (const u of remote) if (u.id !== excludeId) merged.set(u.id, u);
    return [...merged.values()].slice(0, 40);
  }

  function currentUser(): User | undefined {
    const base = deps.currentUserBase();
    if (!base) return base;
    const presence = presenceOverrides[base.id];
    const status = selfStatusOverride();
    if (!(presence || status)) return base;
    return { ...base, ...(presence ? { presence } : {}), ...(status ?? {}) };
  }

  function botBio(appId: string | undefined, botId: string | undefined): string | undefined {
    if (!(appId && botId)) return;
    const known = botBios[appId];
    if (known || pendingBotBios.has(appId)) return known;
    pendingBotBios.add(appId);
    api
      .fetchAppDescription(appId, botId)
      .then((description) => {
        if (description) setBotBios(appId, description);
      })
      .catch(() => {
        pendingBotBios.delete(appId);
      });
    return known;
  }

  // undefined = not fetched yet, [] = fetched and genuinely empty. Callers
  // that fill a signal from this (see UserProfile.tsx) must tell the two
  // apart — a premature undefined-as-[] fill would look "already handled"
  // to the missing-values merge and permanently block the real values.
  function customFieldsFor(id: string): UserCustomField[] | undefined {
    // Read the store key unconditionally (even though it's undefined pre-fetch)
    // so callers reactively track it, same as botBio's `known` read above.
    const known = customFieldsById[id];
    if (loadedCustomFields.has(id) || pendingCustomFields.has(id)) return known;
    pendingCustomFields.add(id);
    // The server route treats "me" as "ask Slack for the authed user's own
    // profile" — passing your own real id instead resolves field visibility
    // as if a stranger were viewing it, so self needs the sentinel.
    const routeId = id === deps.currentUserBase()?.id ? "me" : id;
    api
      .fetchUserCustomFields(routeId)
      .then((fields) => setCustomFieldsById(id, fields ?? []))
      .catch(() => {})
      .finally(() => {
        pendingCustomFields.delete(id);
        loadedCustomFields.add(id);
      });
    return known;
  }

  function openUserProfile(id: string) {
    setProfileUserId(id);
    // presence_change only ever arrives for people already in your DM/sidebar list
    if (id === deps.currentUserBase()?.id) return;
    api
      .fetchUserPresence(id)
      .then((presence) => presence && setPresenceOverrides(id, presence))
      .catch(() => {});
  }

  function closeUserProfile() {
    setProfileUserId(null);
  }

  async function updateMyStatus(text: string, emoji: string, expiration: number): Promise<boolean> {
    try {
      await api.setStatus(text, emoji, expiration);
      setSelfStatusOverride((prev) => ({
        ...prev,
        statusEmoji: emoji || undefined,
        statusText: text || undefined,
      }));
      return true;
    } catch (err) {
      console.error("Failed to set status", err);
      actionFeedback.flash("me", "Failed to update status.", "error");
      return false;
    }
  }

  function clearMyStatus(): Promise<boolean> {
    return updateMyStatus("", "", 0);
  }

  // Profile fields share users.profile.set, so serialize edits. Two quick
  // blurs otherwise race at the network boundary and an older response can
  // leave both Slack and the panel showing the wrong final value.
  const runProfileMutation = createSerialMutationQueue();
  function updateMyProfile(fields: {
    displayName?: string;
    title?: string;
    pronouns?: string;
    customFields?: Record<string, string>;
  }): Promise<boolean> {
    return runProfileMutation(async (): Promise<boolean> => {
      try {
        await api.setProfileFields(fields);
        setSelfStatusOverride((prev) => {
          const next: Partial<User> = { ...prev };
          if (fields.displayName !== undefined) next.name = fields.displayName;
          if (fields.title !== undefined) next.title = fields.title || undefined;
          if (fields.pronouns !== undefined) next.pronouns = fields.pronouns || undefined;
          return next;
        });
        const selfId = deps.currentUserBase()?.id;
        if (fields.customFields && selfId) {
          const merged = new Map((customFieldsById[selfId] ?? []).map((f) => [f.id, f]));
          for (const [id, value] of Object.entries(fields.customFields)) {
            if (value) merged.set(id, { id, value });
            else merged.delete(id);
          }
          setCustomFieldsById(selfId, [...merged.values()]);
          loadedCustomFields.add(selfId);
        }
        return true;
      } catch (err) {
        console.error("Failed to update profile", err);
        actionFeedback.flash(
          "me",
          err instanceof Error ? err.message : "Failed to update profile.",
          "error",
        );
        return false;
      }
    });
  }

  async function updateMyPresence(presence: "auto" | "away"): Promise<boolean> {
    try {
      await api.setPresence(presence);
      const me = currentUser();
      if (me) setPresenceOverrides(me.id, presence === "away" ? "away" : "active");
      return true;
    } catch (err) {
      console.error("Failed to set presence", err);
      actionFeedback.flash("me", "Failed to update presence.", "error");
      return false;
    }
  }

  return {
    botBio,
    cacheUsers,
    clearMyStatus,
    closeUserProfile,
    currentUser,
    customFieldsFor,
    invalidateUser,
    knownUsers,
    openUserProfile,
    profileUserId,
    searchUsers,
    setPresenceOverrides,
    updateMyPresence,
    updateMyProfile,
    updateMyStatus,
    userById,
  };
}
