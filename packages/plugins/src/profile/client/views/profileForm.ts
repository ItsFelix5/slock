import { service } from "@slock/core/solid";
import type { ProfileFieldDef, User } from "@slock/types";
import { createEffect, createSignal, createStore } from "solid-js";
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

function currentValue(user: User | undefined, key: keyof typeof SELF_FIELD_UPDATES): string {
  if (key === "fullName") return user?.realName ?? user?.name ?? "";
  if (key === "name") return user?.name ?? "";
  return user?.[key] ?? "";
}

function createGuardedFlag() {
  const [pending, setPending] = createSignal(false);
  let running = false;
  async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (running) return;
    running = true;
    setPending(true);
    try {
      return await task();
    } finally {
      running = false;
      setPending(false);
    }
  }
  return { pending, run };
}

export function createProfileForm(deps: {
  userId: () => string;
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
  const [savingFields, setSavingFields] = createStore<Record<string, boolean>>({});
  const status = createGuardedFlag();
  const presence = createGuardedFlag();
  const photo = createGuardedFlag();
  const inflightFields = new Set<string>();

  const setInput = (key: ProfileInputKey, value: string) =>
    setInputs((draft) => {
      draft[key] = value;
    });
  const setCustomValue = (id: string, value: string) =>
    setCustomValues((draft) => {
      draft[id] = value;
    });

  createEffect(
    () => [deps.userId(), usersStore.currentUser()?.id],
    ([id]) => {
      if (!id) return;
      const me = usersStore.currentUser();
      const nickname = usersStore.nicknameFor(id) ?? "";
      setInputs((draft) => {
        if (id === me?.id) {
          draft.statusText = me.statusText ?? "";
          draft.statusEmoji = me.statusEmoji ?? "";
          draft.name = me.name;
          draft.fullName = me.realName ?? me.name;
          draft.title = me.title ?? "";
          draft.pronouns = me.pronouns ?? "";
        }
        draft.nickname = nickname;
      });
    },
  );

  createEffect(
    () => {
      const defs = deps.fieldDefs();
      const id = deps.user()?.id;
      if (!(defs && id && id === usersStore.currentUser()?.id)) return;
      const fields = usersStore.customFieldsFor(id);
      return fields && { defs, fields };
    },
    (loaded) => {
      if (!loaded) return;
      const merged = mergeMissingProfileFieldValues(
        { ...customValues },
        loaded.defs,
        loaded.fields,
      );
      setCustomValues((draft) => {
        Object.assign(draft, merged);
      });
    },
  );

  async function saveField(key: string, save: () => Promise<boolean>) {
    if (inflightFields.has(key)) return;
    inflightFields.add(key);
    setSavingFields((draft) => {
      draft[key] = true;
    });
    try {
      await save();
    } finally {
      inflightFields.delete(key);
      setSavingFields((draft) => {
        draft[key] = false;
      });
    }
  }

  function commitSelfField(key: keyof typeof SELF_FIELD_UPDATES) {
    const value = inputs[key].trim();
    if (!value && REQUIRED_SELF_FIELDS.has(key)) return;
    if (value === currentValue(deps.user(), key)) return;
    return saveField(key, () => usersStore.updateMyProfile(SELF_FIELD_UPDATES[key](value)));
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
    return saveField(`custom:${id}`, () =>
      usersStore.updateMyProfile({ customFields: { [id]: value } }),
    );
  }

  const saveStatus = () =>
    status.run(() => usersStore.updateMyStatus(inputs.statusText, inputs.statusEmoji, 0));

  const clearStatus = () =>
    status.run(async () => {
      if (await usersStore.clearMyStatus()) {
        setInputs((draft) => {
          draft.statusText = "";
          draft.statusEmoji = "";
        });
      }
    });

  const togglePresence = () =>
    presence.run(() =>
      usersStore.updateMyPresence(deps.user()?.presence === "away" ? "auto" : "away"),
    );

  const updatePhoto = async (file: File) =>
    (await photo.run(() => usersStore.updateMyProfilePhoto(file))) ?? false;

  return {
    clearStatus,
    commitCustomField,
    commitNickname,
    commitSelfField,
    customValues,
    inputs,
    isSavingField: (key: string) => !!savingFields[key],
    isSavingPhoto: photo.pending,
    isSavingPresence: presence.pending,
    isSavingStatus: status.pending,
    saveStatus,
    setCustomValue,
    setInput,
    togglePresence,
    updatePhoto,
  };
}

export type ProfileForm = ReturnType<typeof createProfileForm>;
