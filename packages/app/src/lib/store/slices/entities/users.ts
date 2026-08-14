import type { User, UserCustomField } from "@slock/slack-api";
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
} from "@slock/slack-api";
import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { createSerialMutationQueue } from "../../mutations/serialMutationQueue";
import { actionFeedback } from "../feedback";
import type { createPanesSlice } from "../session/panes";

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

  const [botBios, setBotBios] = createStore<Record<string, string>>({});
  const pendingBotBios = new Set<string>();

  const [customFieldsById, setCustomFieldsById] = createStore<
    Record<string, UserCustomField[] | undefined>
  >({});
  const [profileStartDatesById, setProfileStartDatesById] = createStore<
    Record<string, string | undefined>
  >({});
  const loadedCustomFields = new Set<string>();
  const pendingCustomFields = new Set<string>();

  function knownUsers(): User[] {
    return Object.values(extraUsers);
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
    if (!presence) return known;
    return { ...known, presence };
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

    const presence = presenceOverrides[base.id] ?? (deps.isSelfOnline() ? "active" : "away");
    const status = selfStatusOverride();
    return { ...base, presence, ...(status ?? {}) };
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

  function customFieldsFor(id: string): UserCustomField[] | undefined {
    const known = customFieldsById[id];
    if (loadedCustomFields.has(id) || pendingCustomFields.has(id)) return known;
    pendingCustomFields.add(id);

    const routeId = id === deps.currentUserBase()?.id ? "me" : id;
    api
      .fetchUserProfile(routeId)
      .then((profile) => {
        setCustomFieldsById(id, profile.customFields ?? []);
        setProfileStartDatesById(id, profile.startDate);
      })
      .catch(() => {})
      .finally(() => {
        pendingCustomFields.delete(id);
        loadedCustomFields.add(id);
      });
    return known;
  }

  function profileStartDateFor(id: string): string | undefined {
    customFieldsFor(id);
    return profileStartDatesById[id];
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

  async function updateMyProfilePhoto(file: File): Promise<boolean> {
    try {
      const avatarUrl = await api.uploadProfilePhoto(file);
      if (avatarUrl) setSelfStatusOverride((prev) => ({ ...prev, avatarUrl }));
      return true;
    } catch (err) {
      console.error("Failed to update profile photo", err);
      actionFeedback.flash(
        "me",
        err instanceof Error ? err.message : "Failed to update profile photo.",
        "error",
      );
      return false;
    }
  }

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
    openUserProfile,
    profileStartDateFor,
    searchUsers,
    setPresenceOverrides,
    updateMyPresence,
    updateMyProfilePhoto,
    updateMyProfile,
    updateMyStatus,
    userById,
  };
}
