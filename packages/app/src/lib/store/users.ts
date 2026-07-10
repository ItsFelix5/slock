import type { User } from "@slock/slack-api";
import {
  setPresence as apiSetPresence,
  setProfileFields as apiSetProfileFields,
  setStatus as apiSetStatus,
  fetchUser,
  searchDirectory,
} from "@slock/slack-api";
import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { actionFeedback } from "./feedback";

export function createUsersSlice(deps: { currentUserBase: () => User | undefined }) {
  const [extraUsers, setExtraUsers] = createStore<Record<string, User>>({});
  const pendingUsers = new Set<string>();
  const [presenceOverrides, setPresenceOverrides] = createStore<Record<string, "active" | "away">>(
    {},
  );
  const [selfStatusOverride, setSelfStatusOverride] = createSignal<Partial<User> | null>(null);
  const [profileUserId, setProfileUserId] = createSignal<string | null>(null);

  // Every user ever resolved this session — via userById's lazy fetchUser,
  // searchUsers' remote matches, or an invalidateUser refresh. There's no bootstrap
  // user list to seed this from (a fixed-size slice of the org is never complete),
  // so it starts empty and fills in as the UI asks about people.
  function knownUsers(): User[] {
    return Object.values(extraUsers);
  }

  function userById(id: string): User | undefined {
    const known = extraUsers[id];
    if (!known) {
      if (!pendingUsers.has(id)) {
        pendingUsers.add(id);
        fetchUser(id)
          .then((user) => {
            if (user) setExtraUsers(id, user);
          })
          .catch(() => {
            pendingUsers.delete(id);
          });
      }
      return undefined;
    }
    const presence = presenceOverrides[id];
    const selfOverride = id === deps.currentUserBase()?.id ? selfStatusOverride() : null;
    if (!presence && !selfOverride) return known;
    return { ...known, ...(presence ? { presence } : {}), ...(selfOverride ?? {}) };
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

    const { users: remote } = await searchDirectory(q);
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
    if (!presence && !status) return base;
    return { ...base, ...(presence ? { presence } : {}), ...(status ?? {}) };
  }

  function openUserProfile(id: string) {
    setProfileUserId(id);
  }

  function closeUserProfile() {
    setProfileUserId(null);
  }

  async function updateMyStatus(text: string, emoji: string, expiration: number) {
    setSelfStatusOverride((prev) => ({
      ...prev,
      statusText: text || undefined,
      statusEmoji: emoji || undefined,
    }));
    try {
      await apiSetStatus(text, emoji, expiration);
    } catch (err) {
      console.error("Failed to set status", err);
      actionFeedback.flash("me", "Failed to update status.", "error");
    }
  }

  async function clearMyStatus() {
    await updateMyStatus("", "", 0);
  }

  async function updateMyProfile(fields: {
    displayName?: string;
    title?: string;
    pronouns?: string;
    customFields?: Record<string, string>;
  }) {
    setSelfStatusOverride((prev) => {
      const next: Partial<User> = { ...prev };
      if (fields.displayName !== undefined) next.name = fields.displayName;
      if (fields.title !== undefined) next.title = fields.title || undefined;
      if (fields.pronouns !== undefined) next.pronouns = fields.pronouns || undefined;
      if (fields.customFields) {
        const merged = new Map(
          (prev?.customFields ?? currentUser()?.customFields ?? []).map((f) => [f.id, f]),
        );
        for (const [id, value] of Object.entries(fields.customFields)) {
          if (value) merged.set(id, { id, value });
          else merged.delete(id);
        }
        next.customFields = [...merged.values()];
      }
      return next;
    });
    try {
      await apiSetProfileFields(fields);
    } catch (err) {
      console.error("Failed to update profile", err);
      actionFeedback.flash(
        "me",
        err instanceof Error ? err.message : "Failed to update profile.",
        "error",
      );
    }
  }

  async function updateMyPresence(presence: "auto" | "away") {
    const me = currentUser();
    if (me) setPresenceOverrides(me.id, presence === "away" ? "away" : "active");
    try {
      await apiSetPresence(presence);
    } catch (err) {
      console.error("Failed to set presence", err);
      actionFeedback.flash("me", "Failed to update presence.", "error");
    }
  }

  return {
    knownUsers,
    userById,
    invalidateUser,
    searchUsers,
    currentUser,
    setPresenceOverrides,
    profileUserId,
    openUserProfile,
    closeUserProfile,
    updateMyStatus,
    clearMyStatus,
    updateMyProfile,
    updateMyPresence,
  };
}
