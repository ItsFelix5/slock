import { service } from "@slock/core/solid";
import { defineMutation } from "@slock/plugins/query/client/api";
import type { ProfileFieldDef, User, UserId } from "@slock/types";
import { createEffect, createMemo, createStore, untrack } from "solid-js";
import { selfInputSeed } from "./selfInputSeed";
import { mergeMissingProfileFieldValues } from "./userProfileFieldValues";

const usersStore = service("users");

export type ProfileInputKey =
  | "name"
  | "fullName"
  | "title"
  | "pronouns"
  | "nickname"
  | "statusText"
  | "statusEmoji";

type ProfileUpdate = Parameters<typeof usersStore.updateMyProfile>[0];

const SELF_FIELD_UPDATES: Record<
  "name" | "fullName" | "title" | "pronouns",
  (value: string) => ProfileUpdate
> = {
  fullName: (fullName) => ({ fullName }),
  name: (displayName) => ({ displayName }),
  pronouns: (pronouns) => ({ pronouns }),
  title: (title) => ({ title }),
};

const REQUIRED_SELF_FIELDS: ReadonlySet<keyof typeof SELF_FIELD_UPDATES> = new Set([
  "name",
  "fullName",
]);

const fieldSave = defineMutation<{ field: string; update: ProfileUpdate }, boolean>({
  key: ({ field }) => field,
  mode: "single",
  run: ({ update }) => usersStore.updateMyProfile(update),
});

function currentValue(user: User | undefined, key: keyof typeof SELF_FIELD_UPDATES): string {
  if (key === "fullName") return user?.realName ?? user?.name ?? "";
  if (key === "name") return user?.name ?? "";
  return user?.[key] ?? "";
}

export function createProfileForm(deps: {
  userId: () => UserId;
  user: () => User | undefined;
  fieldDefs: () => ProfileFieldDef[] | undefined;
}) {
  const [inputs, setInputs] = createStore<Record<ProfileInputKey, string>>({
    fullName: "",
    name: "",
    nickname: "",
    pronouns: "",
    statusEmoji: "",
    statusText: "",
    title: "",
  });
  const [customValues, setCustomValues] = createStore<Record<string, string>>({});

  const setInput = (key: ProfileInputKey, value: string) =>
    setInputs((draft) => {
      draft[key] = value;
    });
  const setCustomValue = (id: string, value: string) =>
    setCustomValues((draft) => {
      draft[id] = value;
    });

  const meId = createMemo(() => usersStore.currentUserId());
  createEffect(
    () => {
      meId();
      return selfInputSeed(deps.userId(), untrack(usersStore.currentUser));
    },
    (seed) =>
      void setInputs((draft) => {
        Object.assign(draft, seed);
      }),
  );

  createEffect(
    () => usersStore.nicknameFor(deps.userId()) ?? "",
    (nickname) => void setInput("nickname", nickname),
  );

  createEffect(
    () => {
      const defs = deps.fieldDefs();
      const id = deps.user()?.id;
      if (!(defs && id && id === usersStore.currentUserId())) return;
      const fields = usersStore.customFieldsFor(id);
      return fields && { defs, fields };
    },
    (loaded) => {
      if (!loaded) return;
      setCustomValues((draft) => {
        Object.assign(
          draft,
          mergeMissingProfileFieldValues({ ...draft }, loaded.defs, loaded.fields),
        );
      });
    },
  );

  function commitSelfField(key: keyof typeof SELF_FIELD_UPDATES) {
    const value = inputs[key].trim();
    if (!value && REQUIRED_SELF_FIELDS.has(key)) return;
    if (value === currentValue(deps.user(), key)) return;
    return fieldSave.run({ field: key, update: SELF_FIELD_UPDATES[key](value) });
  }

  function commitNickname() {
    const id = deps.userId();
    const realName = deps.user()?.originalName ?? deps.user()?.name ?? "";
    const typed = inputs.nickname.trim();
    const next = typed === realName ? "" : typed;
    if (next === (usersStore.nicknameFor(id) ?? "")) return;
    usersStore.setNickname(id, next);
  }

  function commitCustomField(id: string) {
    const value = (customValues[id] ?? "").trim();
    const userId = deps.user()?.id;
    const current =
      (userId && usersStore.customFieldsFor(userId)?.find((f) => f.id === id)?.value) ?? "";
    if (value === current) return;
    return fieldSave.run({
      field: `custom:${id}`,
      update: { customFields: { [id]: value } },
    });
  }

  const saveStatus = () => usersStore.updateMyStatus(inputs.statusText, inputs.statusEmoji, 0);

  const clearStatus = async () => {
    if (!(await usersStore.clearMyStatus())) return;
    setInputs((draft) => {
      draft.statusText = "";
      draft.statusEmoji = "";
    });
  };

  const togglePresence = () =>
    usersStore.updateMyPresence(deps.user()?.presence === "away" ? "auto" : "away");

  return {
    clearStatus,
    commitCustomField,
    commitNickname,
    commitSelfField,
    customValues,
    inputs,
    isSavingField: (field: string) => fieldSave.pending(field),
    saveStatus,
    setCustomValue,
    setInput,
    togglePresence,
  };
}

export type ProfileForm = ReturnType<typeof createProfileForm>;
