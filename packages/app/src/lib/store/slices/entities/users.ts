import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { User } from "../../../api";
import {
  setPresence as apiSetPresence,
  setProfileFields as apiSetProfileFields,
  setStatus as apiSetStatus,
  uploadProfilePhoto as apiUploadProfilePhoto,
  fetchAppDescription,
  fetchUser,
  fetchUserPresence,
  fetchUserProfile,
  searchDirectory,
} from "../../../api";
import { actionFeedback } from "../../../feedback";
import { createLocalPref } from "../../../localPref";
import type { createPanesSlice } from "../session/panes";
import { createUserProfileFields } from "./usersProfileFields";

type UsersApi = {
  fetchAppDescription: typeof fetchAppDescription;
  fetchUser: typeof fetchUser;
  fetchUserProfile: typeof fetchUserProfile;
  fetchUserPresence: typeof fetchUserPresence;
  searchDirectory: typeof searchDirectory;
  setPresence: typeof apiSetPresence;
  setProfileFields: typeof apiSetProfileFields;
  setStatus: typeof apiSetStatus;
  uploadProfilePhoto: typeof apiUploadProfilePhoto;
};

const DEFAULT_USERS_API: UsersApi = {
  fetchAppDescription,
  fetchUser,
  fetchUserProfile,
  fetchUserPresence,
  searchDirectory,
  setPresence: apiSetPresence,
  setProfileFields: apiSetProfileFields,
  setStatus: apiSetStatus,
  uploadProfilePhoto: apiUploadProfilePhoto,
};

export function createUsersSlice(
  deps: {
    currentUserBase: () => User | undefined;
    isSelfOnline: () => boolean;
    panes: Pick<ReturnType<typeof createPanesSlice>, "closePane" | "openInNewPane" | "panes">;
  },
  api: UsersApi = DEFAULT_USERS_API,
) {
  const [extraUsers, setExtraUsers] = createStore<Record<string, User>>({});
  const pendingUsers = new Set<string>();

  const unresolvableUsers = new Set<string>();
  const [presenceOverrides, setPresenceOverrides] = createStore<Record<string, "active" | "away">>(
    {},
  );
  const [selfStatusOverride, setSelfStatusOverride] = createSignal<Partial<User> | null>(null);

  const [nicknames, persistNicknames] = createLocalPref<Record<string, string>>("nicknames", {});

  function withNickname(user: User): User {
    const nickname = nicknames()[user.id];
    return nickname ? { ...user, name: nickname, originalName: user.name } : user;
  }

  const [botBios, setBotBios] = createStore<Record<string, string>>({});
  const pendingBotBios = new Set<string>();

  const { customFieldsFor, profileStartDateFor, updateMyProfile, updateMyProfilePhoto } =
    createUserProfileFields(deps, api, setSelfStatusOverride);

  function knownUsers(): User[] {
    return Object.values(extraUsers).map(withNickname);
  }

  function cacheUsers(users: User[]): void {
    for (const user of users) setExtraUsers(user.id, user);
  }

  function userById(id: string): User | undefined {
    if (!id) return;

    if (id === deps.currentUserBase()?.id) return currentUser();
    const known = extraUsers[id];
    if (!known) {
      if (!(pendingUsers.has(id) || unresolvableUsers.has(id))) {
        pendingUsers.add(id);
        api
          .fetchUser(id)
          .then((user) => {
            if (user) setExtraUsers(id, user);
            else {
              unresolvableUsers.add(id);
            }
          })
          .catch(() => unresolvableUsers.add(id))
          .finally(() => {
            pendingUsers.delete(id);
          });
      }
      return;
    }
    const presence = presenceOverrides[id];
    return withNickname(presence ? { ...known, presence } : known);
  }

  function invalidateUser(id: string) {
    setExtraUsers(
      produce((s) => {
        delete s[id];
      }),
    );
    pendingUsers.delete(id);
    unresolvableUsers.delete(id);
  }

  async function searchUsers(query: string, excludeId?: string): Promise<User[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const local = new Map<string, User>();
    for (const id of Object.keys(extraUsers)) local.set(id, extraUsers[id]);
    const localMatches = [...local.values()].filter(
      (u) =>
        u.id !== excludeId &&
        (u.name.toLowerCase().includes(q) || nicknames()[u.id]?.toLowerCase().includes(q)),
    );

    const { users: remote } = await api.searchDirectory(q);
    for (const u of remote) {
      if (!local.has(u.id)) setExtraUsers(u.id, u);
    }

    const merged = new Map<string, User>();
    for (const u of localMatches) merged.set(u.id, u);
    for (const u of remote) if (u.id !== excludeId) merged.set(u.id, u);
    return [...merged.values()].map(withNickname).slice(0, 40);
  }

  function currentUser(): User | undefined {
    const base = deps.currentUserBase();
    if (!base) return base;

    const presence = presenceOverrides[base.id] ?? (deps.isSelfOnline() ? "active" : "away");
    const status = selfStatusOverride();
    return withNickname({ ...base, presence, ...(status ?? {}) });
  }

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

  function openUserProfile(id: string) {
    deps.panes.openInNewPane({ kind: "profile", userId: id });

    if (id === deps.currentUserBase()?.id) return;
    api
      .fetchUserPresence(id)
      .then((presence) => presence && setPresenceOverrides(id, presence))
      .catch(() => {});
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
      actionFeedback.flash("me", "Failed to update status.", "error");
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
        if (presence === "away") setPresenceOverrides(selfId, "away");
        else
          setPresenceOverrides(
            produce((s) => {
              delete s[selfId];
            }),
          );
      }
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
    nicknameFor,
    openUserProfile,
    profileStartDateFor,
    searchUsers,
    setNickname,
    setPresenceOverrides,
    updateMyPresence,
    updateMyProfilePhoto,
    updateMyProfile,
    updateMyStatus,
    userById,
  };
}
