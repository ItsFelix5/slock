import type { User, UserCustomField } from "@slock/slack-api";
import { createStore } from "solid-js/store";
import { createSerialMutationQueue } from "../../mutations/serialMutationQueue";
import { actionFeedback } from "../feedback";

export function createUserProfileFields(
  deps: { currentUserBase: () => User | undefined },
  api: {
    fetchUserProfile: (
      id: string,
    ) => Promise<{ customFields?: UserCustomField[]; startDate?: string }>;
    setProfileFields: (fields: {
      displayName?: string;
      title?: string;
      pronouns?: string;
      customFields?: Record<string, string>;
    }) => Promise<void>;
    uploadProfilePhoto: (file: File) => Promise<string | undefined>;
  },
  setSelfStatusOverride: (updater: (prev: Partial<User> | null) => Partial<User> | null) => void,
) {
  const [customFieldsById, setCustomFieldsById] = createStore<
    Record<string, UserCustomField[] | undefined>
  >({});
  const [profileStartDatesById, setProfileStartDatesById] = createStore<
    Record<string, string | undefined>
  >({});
  const loadedCustomFields = new Set<string>();
  const pendingCustomFields = new Set<string>();

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

  return { customFieldsFor, profileStartDateFor, updateMyProfile, updateMyProfilePhoto };
}
