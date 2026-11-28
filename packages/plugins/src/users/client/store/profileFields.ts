import { defineQuery } from "@slock/plugins/query/client/api";
import type { UserCustomField, UserId, UserProfile } from "@slock/types";
import type { UsersApi } from "./usersApi";

export function createUserProfiles(fetchUserProfile: UsersApi["fetchUserProfile"]) {
  const profiles = defineQuery<UserId, UserProfile>({
    load: (id, { signal }) => fetchUserProfile(id, signal),
    name: "userProfiles",
  });

  function mergeCustomFields(id: UserId, changes: Record<string, string>): void {
    profiles.modify(id, (profile) => {
      const merged = new Map<string, UserCustomField>(
        (profile.customFields ?? []).map((field) => [field.id, field]),
      );
      for (const [fieldId, value] of Object.entries(changes)) {
        if (value) merged.set(fieldId, { id: fieldId, value });
        else merged.delete(fieldId);
      }
      return { ...profile, customFields: [...merged.values()] };
    });
  }

  return {
    customFieldsFor: (id: UserId) => profiles.peek(id)?.customFields,
    mergeCustomFields,
    profileStartDateFor: (id: UserId) => profiles.peek(id)?.startDate,
  };
}
