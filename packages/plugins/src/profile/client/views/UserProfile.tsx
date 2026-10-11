import { service } from "@slock/core/solid";
import { Button, InlineFeedback, type Pane, PanelHeader } from "@slock/ui";
import { createQuery } from "@tanstack/solid-query";
import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js";
import { fetchProfileFieldDefs } from "../../../slack/client/api";
import type { ProfilePaneContent } from "../api";
import ProfilePhotoEditor from "./ProfilePhotoEditor";
import "./UserProfile.css";
import { defineKey } from "../../../query/client/api";
import UserProfileContact from "./UserProfileContact";
import UserProfileInfo from "./UserProfileInfo";
import { isCustomFieldDef, mergeMissingProfileFieldValues } from "./userProfileFieldValues";
import { createLocalTime, createTzDiff, createTzSuffix } from "./userProfileTime";

const profileFieldDefsKey = defineKey<[]>("profileFieldDefs");

const feedback = service("feedback");

const query = service("query");
const viewStore = service("shell.view");
const usersStore = service("users");

export default function UserProfile(props: { pane: Pane<ProfilePaneContent> }) {
  const profileUserId = () => props.pane.content.userId;
  const profileFieldDefs = createQuery(
    () => ({ queryFn: fetchProfileFieldDefs, queryKey: profileFieldDefsKey() }),
    () => query.client,
  );
  const [nameInput, setNameInput] = createSignal("");
  const [titleInput, setTitleInput] = createSignal("");
  const [pronounsInput, setPronounsInput] = createSignal("");
  const [nicknameInput, setNicknameInput] = createSignal("");
  const [customFieldInputs, setCustomFieldInputs] = createSignal<Record<string, string>>({});
  const [statusText, setStatusText] = createSignal("");
  const [statusEmoji, setStatusEmoji] = createSignal("");
  const [savingStatus, setSavingStatus] = createSignal(false);
  const [savingPresence, setSavingPresence] = createSignal(false);
  const [savingProfilePhoto, setSavingProfilePhoto] = createSignal(false);
  const [photoToEdit, setPhotoToEdit] = createSignal<File>();
  const [savingProfileFields, setSavingProfileFields] = createSignal<Record<string, boolean>>({});
  const user = createMemo(() => {
    const base = usersStore.userById(profileUserId());
    if (!base) return base;
    const presence = base.isBot ? undefined : usersStore.presenceFor(base.id);
    return presence ? { ...base, presence } : base;
  });
  const isSelf = () => user()?.id === usersStore.currentUser()?.id;
  const botBio = () =>
    user()?.isBot ? usersStore.botBio(user()?.appId, user()?.botId) : undefined;
  createEffect(
    on([profileUserId, () => usersStore.currentUser()?.id], ([id]) => {
      const me = usersStore.currentUser();
      if (id === me?.id) {
        setStatusText(me.statusText ?? "");
        setStatusEmoji(me.statusEmoji ?? "");
        setNameInput(me.name);
        setTitleInput(me.title ?? "");
        setPronounsInput(me.pronouns ?? "");
      }
      setNicknameInput(usersStore.nicknameFor(id) ?? "");
    }),
  );

  createEffect(() => {
    const defs = profileFieldDefs.data;
    const id = user()?.id;
    const me = usersStore.currentUser();
    if (!(defs && id && me && id === me.id)) return;
    const fields = usersStore.customFieldsFor(id);
    if (!fields) return;
    setCustomFieldInputs((current) => mergeMissingProfileFieldValues(current, defs, fields));
  });
  const saveProfileField = async (key: string, save: () => Promise<boolean>) => {
    if (savingProfileFields()[key]) return;
    setSavingProfileFields((current) => ({ ...current, [key]: true }));
    try {
      await save();
    } finally {
      setSavingProfileFields((current) => ({ ...current, [key]: false }));
    }
  };
  const saveName = () => {
    const v = nameInput().trim();
    if (!v || v === user()?.name) return;
    return saveProfileField("name", () => usersStore.updateMyProfile({ displayName: v }));
  };
  const saveTitle = () => {
    const v = titleInput().trim();
    if (v === (user()?.title ?? "")) return;
    return saveProfileField("title", () => usersStore.updateMyProfile({ title: v }));
  };
  const savePronouns = () => {
    const v = pronounsInput().trim();
    if (v === (user()?.pronouns ?? "")) return;
    return saveProfileField("pronouns", () => usersStore.updateMyProfile({ pronouns: v }));
  };
  const saveNickname = () => {
    const id = profileUserId();
    const realName = user()?.originalName ?? user()?.name ?? "";
    const v = nicknameInput().trim();
    const next = v === realName ? "" : v;
    if (next === (usersStore.nicknameFor(id) ?? "")) return;
    usersStore.setNickname(id, next);
  };
  const saveCustomField = (id: string) => {
    const v = (customFieldInputs()[id] ?? "").trim();
    const userId = user()?.id;
    const current =
      (userId && usersStore.customFieldsFor(userId)?.find((f) => f.id === id)?.value) ?? "";
    if (v === current) return;
    return saveProfileField(`custom:${id}`, () =>
      usersStore.updateMyProfile({ customFields: { [id]: v } }),
    );
  };
  const saveStatus = async () => {
    if (savingStatus()) return;
    setSavingStatus(true);
    try {
      await usersStore.updateMyStatus(statusText(), statusEmoji(), 0);
    } finally {
      setSavingStatus(false);
    }
  };
  const clearStatus = async () => {
    if (savingStatus()) return;
    setSavingStatus(true);
    try {
      if (await usersStore.clearMyStatus()) {
        setStatusText("");
        setStatusEmoji("");
      }
    } finally {
      setSavingStatus(false);
    }
  };
  const togglePresence = async () => {
    if (savingPresence()) return;
    const next = user()?.presence === "away" ? "auto" : "away";
    setSavingPresence(true);
    try {
      await usersStore.updateMyPresence(next);
    } finally {
      setSavingPresence(false);
    }
  };
  const updateProfilePhoto = async (file: File) => {
    if (savingProfilePhoto()) return false;
    setSavingProfilePhoto(true);
    try {
      return await usersStore.updateMyProfilePhoto(file);
    } finally {
      setSavingProfilePhoto(false);
    }
  };
  const [now, setNow] = createSignal(Date.now());
  const clockTimer = setInterval(() => setNow(Date.now()), 60_000);
  onCleanup(() => clearInterval(clockTimer));
  const localTime = createLocalTime(user, now);
  const tzDiff = createTzDiff(user, now);
  const tzSuffix = createTzSuffix(user, tzDiff);
  const startDate = createMemo(() => {
    const u = user();
    return u?.startDate ?? (u ? usersStore.profileStartDateFor(u.id) : undefined);
  });
  const customFields = createMemo(() => {
    const defs = profileFieldDefs.data;
    const id = user()?.id;
    const values = id ? usersStore.customFieldsFor(id) : undefined;
    if (!(defs && values?.length)) return [];
    const definitionById = new Map(defs.map((d) => [d.id, d]));
    return values
      .map((f) => ({ ...f, definition: definitionById.get(f.id) }))
      .filter(
        (f): f is typeof f & { definition: { label: string; type?: string } } =>
          !!f.definition?.label && isCustomFieldDef(f.definition),
      )
      .map(({ definition, ...field }) => ({
        ...field,
        label: definition.label,
        type: definition.type,
      }));
  });
  const editableCustomFields = createMemo(() =>
    (profileFieldDefs.data ?? []).filter(isCustomFieldDef),
  );
  return (
    <>
      <div class="user-profile-panel flex-col" data-pane={props.pane.id}>
        <PanelHeader
          canClose={viewStore.canCloseTile()}
          onClose={() => viewStore.closeTile(props.pane.id)}
          title="Profile"
        />
        <Show
          fallback={
            <div class="user-profile-body text-muted">
              {usersStore.isUnresolvableUser(profileUserId())
                ? "Profile unavailable"
                : "Loading profile…"}
            </div>
          }
          when={user()}
        >
          {(u) => (
            <div class="user-profile-body">
              <InlineFeedback
                class="user-profile-feedback truncate"
                feedback={feedback.get(isSelf() ? "me" : u().id)}
                priority={2}
              />
              <UserProfileInfo
                botBio={botBio}
                clearStatus={clearStatus}
                isSavingProfilePhoto={savingProfilePhoto}
                isSavingPresence={savingPresence}
                isSelf={isSelf}
                localTime={localTime}
                tzSuffix={tzSuffix}
                nameInput={nameInput}
                nicknameInput={nicknameInput}
                onProfilePhotoSelected={setPhotoToEdit}
                onTogglePresence={togglePresence}
                pronounsInput={pronounsInput}
                saveName={saveName}
                saveNickname={saveNickname}
                savePronouns={savePronouns}
                saveStatus={saveStatus}
                saveTitle={saveTitle}
                savingProfileFields={savingProfileFields}
                savingStatus={savingStatus}
                setNameInput={setNameInput}
                setNicknameInput={setNicknameInput}
                setPronounsInput={setPronounsInput}
                setStatusEmoji={setStatusEmoji}
                setStatusText={setStatusText}
                setTitleInput={setTitleInput}
                statusEmoji={statusEmoji}
                statusText={statusText}
                titleInput={titleInput}
                user={u}
              />
              <UserProfileContact
                customFields={customFields()}
                editableFields={editableCustomFields()}
                isSelf={isSelf()}
                isSavingField={(id) => !!savingProfileFields()[`custom:${id}`]}
                data-commit-on-enter
                saveField={saveCustomField}
                setValue={(id, value) => setCustomFieldInputs((prev) => ({ ...prev, [id]: value }))}
                startDate={startDate()}
                user={u()}
                values={customFieldInputs()}
              />
              <Show when={profileFieldDefs.error}>
                <div class="user-profile-fields-warning flex-between">
                  <span>Additional profile fields are unavailable.</span>
                  <Button
                    disabled={profileFieldDefs.isFetching}
                    onClick={() => void profileFieldDefs.refetch()}
                    size="sm"
                  >
                    {profileFieldDefs.isFetching ? "Retrying…" : "Try again"}
                  </Button>
                </div>
              </Show>
            </div>
          )}
        </Show>
      </div>
      <Show when={photoToEdit()}>
        {(file) => (
          <ProfilePhotoEditor
            file={file()}
            onClose={() => setPhotoToEdit(undefined)}
            onSave={updateProfilePhoto}
          />
        )}
      </Show>
    </>
  );
}
