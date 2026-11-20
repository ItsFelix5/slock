import { defined } from "@slock/core";
import { service } from "@slock/core/solid";
import type { Services } from "@slock/core/types";
import { SLACK_SYSTEM_USER, SLACK_USER_ID } from "@slock/slack";
import type { User, UserId } from "@slock/types";
import { createMemo, createSignal, createStore, snapshot } from "solid-js";
import { createLocalPref } from "../../../slack/client/api/localPref";
import { createDerivedUsers } from "./derivedUsers";
import { createUserProfileFields } from "./profileFields";
import { DEFAULT_USERS_API, type UsersApi } from "./usersApi";

const feedback = service("feedback");

export function createUsersStore(
  deps: {
    currentUserBase: () => User | undefined;
    isSelfOnline: () => boolean;
    panes: Pick<Services["shell.panes"], "closePane" | "openInNewPane" | "panes">;
  },
  api: UsersApi = DEFAULT_USERS_API,
) {
  const [extraUsers, setExtraUsers] = createStore<Record<string, User>>({});
  const [userAliases, setUserAliases] = createStore<Record<string, string>>({});
  const pendingUsers = new Set<string>();

  const [unresolvableUsers, setUnresolvableUsers] = createStore<Record<string, boolean>>({});
  const [presenceOverrides, setPresenceOverrides] = createStore<Record<string, "active" | "away">>(
    {},
  );
  const requestedPresence = new Set<string>();
  const markUnresolvable = (id: string, unresolvable: boolean) =>
    setUnresolvableUsers((draft) => {
      draft[id] = unresolvable;
    });
  const [selfStatusOverride, setSelfStatusOverride] = createSignal<Partial<User> | null>(null);

  const [nicknames, persistNicknames] = createLocalPref<Record<string, string>>("nicknames", {});

  function withNickname(user: User): User {
    const nickname = nicknames()[user.id];
    return nickname ? { ...user, name: nickname, originalName: user.name } : user;
  }

  const [botBios, setBotBios] = createStore<Record<string, string>>({});
  const requestedBotBios = new Set<string>();

  const { customFieldsFor, profileStartDateFor, updateMyProfile, updateMyProfilePhoto } =
    createUserProfileFields(deps, api, setSelfStatusOverride);

  function knownUsers(): User[] {
    return Object.values(extraUsers).map(withNickname);
  }

  function putUser(user: User): void {
    const current = snapshot(extraUsers[user.id]);
    const keys = Object.keys(user);
    if (
      current &&
      keys.length === Object.keys(current).length &&
      keys.every((key) => Reflect.get(current, key) === Reflect.get(user, key))
    )
      return;
    setExtraUsers((draft) => {
      draft[user.id] = user;
    });
  }

  function cacheUsers(users: User[]): void {
    for (const user of users) putUser(user);
  }

  const idByName = createMemo(() => {
    const map = new Map<string, string>();
    for (const user of Object.values(extraUsers))
      if (!map.has(user.name)) map.set(user.name, user.id);
    return map;
  });

  function userIdByName(name: string): string | undefined {
    const me = deps.currentUserBase();
    if (me?.name === name) return me.id;
    return idByName().get(name);
  }

  const derivedUser = createDerivedUsers({
    nicknameOf: (id) => nicknames()[id],
    presenceOf: (id) => presenceOverrides[id],
    withNickname,
  });

  function userById(id: string): User | undefined {
    if (!id) return;
    if (id === SLACK_USER_ID) return SLACK_SYSTEM_USER;
    const alias = userAliases[id];
    if (alias) return userById(alias);
    if (id === deps.currentUserBase()?.id) return currentUser();
    const known = extraUsers[id];
    if (!known) {
      if (!(pendingUsers.has(id) || unresolvableUsers[id])) {
        pendingUsers.add(id);
        api
          .fetchUser(id)
          .then((user) => {
            if (user) {
              putUser(user);
              if (user.id !== id)
                setUserAliases((draft) => {
                  draft[id] = user.id;
                });
            } else {
              markUnresolvable(id, true);
            }
          })
          .catch(() => markUnresolvable(id, true))
          .finally(() => {
            pendingUsers.delete(id);
          });
      }
      return;
    }
    return derivedUser(id, known);
  }

  function presenceFor(id: string): "active" | "away" | undefined {
    if (!id || id === SLACK_USER_ID || id.startsWith("B")) return;
    if (id === deps.currentUserBase()?.id) return currentUser()?.presence;
    const known = presenceOverrides[id];
    if (known !== undefined || requestedPresence.has(id)) return known;
    requestedPresence.add(id);
    api
      .fetchUserPresence(id)
      .then((presence) => presence && recordPeerPresence(id, presence))
      .catch(() => {});
    return known;
  }

  function invalidateUser(id: string) {
    setExtraUsers((draft) => {
      delete draft[id];
    });
    pendingUsers.delete(id);
    markUnresolvable(id, false);
  }

  function recordPeerPresence(id: string, presence: "active" | "away") {
    setPresenceOverrides((draft) => {
      draft[id] = presence;
    });
  }

  async function searchUsers(query: string, excludeId?: string): Promise<User[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const local = new Map<string, User>();
    for (const id of Object.keys(extraUsers)) local.set(id, defined(extraUsers[id]));
    const localMatches = [...local.values()].filter(
      (u) =>
        u.id !== excludeId &&
        (u.name.toLowerCase().includes(q) || nicknames()[u.id]?.toLowerCase().includes(q)),
    );

    const { users: remote } = await api.searchDirectory(q);
    for (const u of remote) {
      if (!local.has(u.id)) putUser(u);
    }

    const merged = new Map<string, User>();
    for (const u of localMatches) merged.set(u.id, u);
    for (const u of remote) if (u.id !== excludeId) merged.set(u.id, u);
    return [...merged.values()].map(withNickname).slice(0, 40);
  }

  function sameUser(a: User | undefined, b: User | undefined): boolean {
    if (a === b) return true;
    if (!(a && b)) return false;
    const entries = Object.entries(a);
    return (
      entries.length === Object.keys(b).length &&
      entries.every(([key, value]) => Reflect.get(b, key) === value)
    );
  }

  const currentUser = createMemo<User | undefined>(
    () => {
      const base = deps.currentUserBase();
      if (!base) return base;

      const presence = presenceOverrides[base.id] ?? (deps.isSelfOnline() ? "active" : "away");
      const status = selfStatusOverride();
      return withNickname({ ...base, presence, ...(status ?? {}) });
    },
    { equals: sameUser },
  );

  function nicknameFor(id: string): string | undefined {
    return nicknames()[id];
  }

  function setNickname(id: string, nickname: string): void {
    const trimmed = nickname.trim();
    const next = { ...nicknames() };
    if (trimmed) next[id] = trimmed;
    else delete next[id];
    persistNicknames(next);
  }

  function botBio(appId: string | undefined, botId: string | undefined): string | undefined {
    if (!(appId && botId)) return;
    const known = botBios[appId];
    if (known || requestedBotBios.has(appId)) return known;
    requestedBotBios.add(appId);
    api
      .fetchAppDescription(appId, botId)
      .then((description) => {
        if (description)
          setBotBios((draft) => {
            draft[appId] = description;
          });
      })
      .catch(() => {});
    return known;
  }

  function openUserProfile(id: UserId) {
    deps.panes.openInNewPane({ kind: "profile", userId: id });
  }

  function closeUserProfile() {
    const profile = deps.panes.panes().find((p) => p.content?.kind === "profile");
    if (profile) deps.panes.closePane(profile.id);
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
      feedback.flash("me", "Failed to update status.", "error");
      return false;
    }
  }

  function clearMyStatus(): Promise<boolean> {
    return updateMyStatus("", "", 0);
  }

  async function updateMyPresence(presence: "auto" | "away"): Promise<boolean> {
    try {
      await api.setPresence(presence);
      const selfId = deps.currentUserBase()?.id;
      if (selfId) {
        setPresenceOverrides((draft) => {
          if (presence === "away") draft[selfId] = "away";
          else delete draft[selfId];
        });
      }
      return true;
    } catch (err) {
      console.error("Failed to set presence", err);
      feedback.flash("me", "Failed to update presence.", "error");
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
    nicknameFor,
    openUserProfile,
    presenceFor,
    profileStartDateFor,
    searchUsers,
    setNickname,
    setPresenceOverrides: recordPeerPresence,
    updateMyPresence,
    updateMyProfilePhoto,
    updateMyProfile,
    updateMyStatus,
    userById,
    userIdByName,
    isUnresolvableUser: (id: string) => !!unresolvableUsers[id],
  };
}
