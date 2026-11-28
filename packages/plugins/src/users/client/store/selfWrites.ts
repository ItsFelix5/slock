import { errorMessage } from "@slock/core";
import { service } from "@slock/core/solid";
import { defineMutation } from "@slock/plugins/query/client/api";
import type { User, UserId } from "@slock/types";
import { createSignal } from "solid-js";
import type { Presence } from "./presence";
import type { UsersApi } from "./usersApi";

const feedback = service("feedback");

type ProfileUpdate = Parameters<UsersApi["setProfileFields"]>[0];

function failed(log: string, message: (error: unknown) => string) {
  return (error: unknown) => {
    console.error(log, error);
    feedback.flash("me", message(error), "error");
  };
}

export function createSelfWrites(deps: {
  api: UsersApi;
  mergeCustomFields: (id: UserId, changes: Record<string, string>) => void;
  presence: { forget: (id: UserId) => void; record: (id: UserId, presence: Presence) => void };
  selfId: () => UserId | undefined;
}) {
  const { api } = deps;
  const [overrides, setOverrides] = createSignal<Partial<User> | null>(null);
  const override = (changes: Partial<User>) => setOverrides((prev) => ({ ...prev, ...changes }));

  const status = defineMutation<{ emoji: string; expiration: number; text: string }>({
    mode: "single",
    onError: failed("Failed to set status", () => "Failed to update status."),
    onSuccess: (_result, { emoji, text }) =>
      override({ statusEmoji: emoji || undefined, statusText: text || undefined }),
    run: ({ emoji, expiration, text }) => api.setStatus(text, emoji, expiration),
  });

  const presence = defineMutation<"auto" | "away">({
    mode: "single",
    onError: failed("Failed to set presence", () => "Failed to update presence."),
    onSuccess: (_result, choice) => {
      const id = deps.selfId();
      if (!id) return;
      if (choice === "away") deps.presence.record(id, "away");
      else deps.presence.forget(id);
    },
    run: (choice) => api.setPresence(choice),
  });

  const photo = defineMutation<File, string | undefined>({
    mode: "single",
    onError: failed("Failed to update profile photo", (error) =>
      errorMessage(error, "Failed to update profile photo."),
    ),
    onSuccess: (avatarUrl) => {
      if (avatarUrl) override({ avatarUrl });
    },
    run: (file) => api.uploadProfilePhoto(file),
  });

  const profile = defineMutation<ProfileUpdate>({
    mode: "queue",
    onError: failed("Failed to update profile", (error) =>
      errorMessage(error, "Failed to update profile."),
    ),
    onSuccess: (_result, { customFields, displayName, fullName, pronouns, title }) => {
      override({
        ...(displayName !== undefined && { name: displayName }),
        ...(fullName !== undefined && { realName: fullName }),
        ...(title !== undefined && { title: title || undefined }),
        ...(pronouns !== undefined && { pronouns: pronouns || undefined }),
      });
      const id = deps.selfId();
      if (customFields && id) deps.mergeCustomFields(id, customFields);
    },
    run: (fields) => api.setProfileFields(fields),
  });

  const updateMyStatus = (text: string, emoji: string, expiration: number) =>
    status.run({ emoji, expiration, text });

  return {
    clearMyStatus: () => updateMyStatus("", "", 0),
    isSavingPhoto: () => photo.pending(),
    isSavingPresence: () => presence.pending(),
    isSavingStatus: () => status.pending(),
    overrides,
    updateMyPresence: (choice: "auto" | "away") => presence.run(choice),
    updateMyProfile: (fields: ProfileUpdate) => profile.run(fields),
    updateMyProfilePhoto: (file: File) => photo.run(file),
    updateMyStatus,
  };
}
