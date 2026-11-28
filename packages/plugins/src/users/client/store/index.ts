import type { Services } from "@slock/core/types";
import { appProfile } from "@slock/plugins/slack/client/api/apps";
import { createLocalPref } from "@slock/plugins/slack/client/api/localPref";
import { mapUser, SLACK_USER_ID } from "@slock/slack";
import type { User, UserId } from "@slock/types";
import { createMemo } from "solid-js";
import { createDerivedUsers } from "./derivedUsers";
import { createPresence, type Presence } from "./presence";
import { createUserProfiles } from "./profileFields";
import { createUserRecords, sameUser } from "./records";
import { createSelfWrites } from "./selfWrites";
import { DEFAULT_USERS_API, type UsersApi } from "./usersApi";

export function createUsersStore(
  deps: {
    currentUserBase: () => User | undefined;
    isSelfOnline: () => boolean;
    panes: Pick<Services["shell.panes"], "closePane" | "openInNewPane" | "panes">;
  },
  api: UsersApi = DEFAULT_USERS_API,
) {
  const records = createUserRecords(api.fetchUser);
  const presence = createPresence(api.fetchUserPresence);
  const profiles = createUserProfiles(api.fetchUserProfile);
  const currentUserId = createMemo(() => deps.currentUserBase()?.id);
  const { overrides, ...selfWrites } = createSelfWrites({
    api,
    mergeCustomFields: profiles.mergeCustomFields,
    presence,
    selfId: currentUserId,
  });

  const [nicknames, persistNicknames] = createLocalPref<Record<UserId, string>>("nicknames", {});

  function withNickname(user: User): User {
    const nickname = nicknames()[user.id];
    return nickname ? { ...user, name: nickname, originalName: user.name } : user;
  }

  function knownUsers(): User[] {
    return records.cached().map(withNickname);
  }

  function cacheUsers(users: User[]): void {
    for (const user of users) records.put(user);
  }

  function userIdByName(name: string): UserId | undefined {
    const me = deps.currentUserBase();
    if (me?.name === name) return me.id;
    return records.idByName(name);
  }

  const derivedUser = createDerivedUsers({
    nicknameOf: (id) => nicknames()[id],
    presenceOf: presence.known,
    withNickname,
  });

  function userById(id: UserId): User | undefined {
    if (id === SLACK_USER_ID) return SLACK_SYSTEM_USER;
    if (id === deps.currentUserBase()?.id) return currentUser();
    const record = records.peek(id);
    if (typeof record === "string") return userById(record);
    return record ? derivedUser(id, record) : undefined;
  }

  function presenceFor(id: UserId): Presence | undefined {
    if (id === SLACK_USER_ID || id.startsWith("B")) return;
    if (id === deps.currentUserBase()?.id) return currentUser()?.presence;
    return presence.watch(id);
  }

  async function searchUsers(query: string, excludeId?: UserId): Promise<User[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const local = new Map(records.cached().map((user) => [user.id, user]));
    const localMatches = [...local.values()].filter(
      (u) =>
        u.id !== excludeId &&
        (u.name.toLowerCase().includes(q) || nicknames()[u.id]?.toLowerCase().includes(q)),
    );

    const { users: remote } = await api.searchDirectory(q);
    for (const u of remote) {
      if (!local.has(u.id)) records.put(u);
    }

    const merged = new Map<UserId, User>();
    for (const u of localMatches) merged.set(u.id, u);
    for (const u of remote) if (u.id !== excludeId) merged.set(u.id, u);
    return [...merged.values()].map(withNickname).slice(0, 40);
  }

  const currentUser = createMemo<User | undefined>(
    () => {
      const base = deps.currentUserBase();
      if (!base) return base;

      const shown = presence.known(base.id) ?? (deps.isSelfOnline() ? "active" : "away");
      return withNickname({ ...base, presence: shown, ...overrides() });
    },
    { equals: sameUser },
  );

  function nicknameFor(id: UserId): string | undefined {
    return nicknames()[id];
  }

  function setNickname(id: UserId, nickname: string): void {
    const trimmed = nickname.trim();
    const next = { ...nicknames() };
    if (trimmed) next[id] = trimmed;
    else delete next[id];
    persistNicknames(next);
  }

  function botBio(appId: string | undefined, botId: string | undefined): string | undefined {
    if (!(appId && botId)) return;
    return appProfile.peek({ appId, botId })?.desc || undefined;
  }

  function openUserProfile(id: UserId) {
    deps.panes.openInNewPane({ kind: "profile", userId: id });
  }

  function closeUserProfile() {
    const profile = deps.panes.panes().find((p) => p.content?.kind === "profile");
    if (profile) deps.panes.closePane(profile.id);
  }

  return {
    ...selfWrites,
    botBio,
    cacheUsers,
    closeUserProfile,
    currentUser,
    currentUserId,
    customFieldsFor: profiles.customFieldsFor,
    invalidateUser: records.invalidate,
    isUserUnavailable: records.isUnavailable,
    knownPresence: presence.known,
    knownUsers,
    loadPresence: presence.load,
    nicknameFor,
    openUserProfile,
    presenceFor,
    profileStartDateFor: profiles.profileStartDateFor,
    searchUsers,
    setNickname,
    setPresenceOverrides: presence.record,
    userById,
    userIdByName,
  };
}

export const SLACK_SYSTEM_USER: User = mapUser({ id: SLACK_USER_ID, name: "Slack" });
