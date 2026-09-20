import { Button, blurOnEnter, InlineFeedback, type Pane, PanelHeader } from "@slock/ui";
import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js";
import { actionFeedback } from "../../lib/feedback";
import { store } from "../../lib/store";
import type { ProfilePaneContent } from "../../lib/store/slices/types";
import "../settings/Settings.css";
import ProfilePhotoEditor from "./ProfilePhotoEditor";
import "./UserProfile.css";
import UserProfileContact from "./UserProfileContact";
import UserProfileInfo from "./UserProfileInfo";
import { isCustomFieldDef, mergeMissingProfileFieldValues } from "./userProfileFieldValues";
import { createLastSeenText, createLocalTime } from "./userProfileTime";

export default function UserProfile(props: { pane: Pane<ProfilePaneContent> }) {
  const profileUserId = () => props.pane.content.userId;
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
    const base = store.users.userById(profileUserId());
    if (!base) return base;
    const presence = store.users.presenceFor(base.id);
    return presence ? { ...base, presence } : base;
  });
  const isSelf = () => user()?.id === store.users.currentUser()?.id;
  const botBio = () =>
    user()?.isBot ? store.users.botBio(user()?.appId, user()?.botId) : undefined;
  createEffect(() => {
    store.resources.loadProfileFieldDefs();
  });
  createEffect(
    on([profileUserId, () => store.users.currentUser()?.id], ([id]) => {
      const me = store.users.currentUser();
      if (id === me?.id) {
        setStatusText(me.statusText ?? "");
        setStatusEmoji(me.statusEmoji ?? "");
        setNameInput(me.name);
        setTitleInput(me.title ?? "");
        setPronounsInput(me.pronouns ?? "");
      }
      setNicknameInput(store.users.nicknameFor(id) ?? "");
    }),
  );

  createEffect(() => {
    const defs = store.resources.profileFieldDefs.data;
    const id = user()?.id;
    const me = store.users.currentUser();
    if (!(defs && id && me && id === me.id)) return;
    const fields = store.users.customFieldsFor(id);
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
    return saveProfileField("name", () => store.users.updateMyProfile({ displayName: v }));
  };
  const saveTitle = () => {
    const v = titleInput().trim();
    if (v === (user()?.title ?? "")) return;
    return saveProfileField("title", () => store.users.updateMyProfile({ title: v }));
  };
  const savePronouns = () => {
    const v = pronounsInput().trim();
    if (v === (user()?.pronouns ?? "")) return;
    return saveProfileField("pronouns", () => store.users.updateMyProfile({ pronouns: v }));
  };
  const saveNickname = () => {
    const id = profileUserId();
    const realName = user()?.originalName ?? user()?.name ?? "";
    const v = nicknameInput().trim();
    const next = v === realName ? "" : v;
    if (next === (store.users.nicknameFor(id) ?? "")) return;
    store.users.setNickname(id, next);
  };
  const saveCustomField = (id: string) => {
    const v = (customFieldInputs()[id] ?? "").trim();
    const userId = user()?.id;
    const current =
      (userId && store.users.customFieldsFor(userId)?.find((f) => f.id === id)?.value) ?? "";
    if (v === current) return;
    return saveProfileField(`custom:${id}`, () =>
      store.users.updateMyProfile({ customFields: { [id]: v } }),
    );
  };
  const saveStatus = async () => {
    if (savingStatus()) return;
    setSavingStatus(true);
    try {
      await store.users.updateMyStatus(statusText(), statusEmoji(), 0);
    } finally {
      setSavingStatus(false);
    }
  };
  const clearStatus = async () => {
    if (savingStatus()) return;
    setSavingStatus(true);
    try {
      if (await store.users.clearMyStatus()) {
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
      await store.users.updateMyPresence(next);
    } finally {
      setSavingPresence(false);
    }
  };
  const updateProfilePhoto = async (file: File) => {
    if (savingProfilePhoto()) return false;
    setSavingProfilePhoto(true);
    try {
      return await store.users.updateMyProfilePhoto(file);
    } finally {
      setSavingProfilePhoto(false);
    }
  };
  const [now, setNow] = createSignal(Date.now());
  const clockTimer = setInterval(() => setNow(Date.now()), 60_000);
  onCleanup(() => clearInterval(clockTimer));
  const localTime = createLocalTime(user, now);
  const latestMessageTs = createMemo(() => store.messages.latestMessageTsMsByUser(profileUserId()));
  const lastSeenText = createLastSeenText(user, now, latestMessageTs);
  const startDate = createMemo(() => {
    const u = user();
    return u?.startDate ?? (u ? store.users.profileStartDateFor(u.id) : undefined);
  });
  const customFields = createMemo(() => {
    const defs = store.resources.profileFieldDefs.data;
    const id = user()?.id;
    const values = id ? store.users.customFieldsFor(id) : undefined;
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
    (store.resources.profileFieldDefs.data ?? []).filter(isCustomFieldDef),
  );
  return (
    <>
      <div class="user-profile-panel" data-pane={props.pane.id}>
        <PanelHeader
          canClose={store.viewState.canCloseTile()}
          onClose={() => store.viewState.closeTile(props.pane.id)}
          title="Profile"
        />
        <Show when={user()}>
          {(u) => (
            <div class="user-profile-body">
              <InlineFeedback
                class="user-profile-feedback"
                feedback={actionFeedback.get(isSelf() ? "me" : u().id)}
                priority={2}
              />
              <UserProfileInfo
                blurOnEnter={blurOnEnter}
                botBio={botBio}
                clearStatus={clearStatus}
                isSavingProfilePhoto={savingProfilePhoto}
                isSavingPresence={savingPresence}
                isSelf={isSelf}
                lastSeenText={lastSeenText}
                localTime={localTime}
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
                onKeyDown={blurOnEnter}
                saveField={saveCustomField}
                setValue={(id, value) => setCustomFieldInputs((prev) => ({ ...prev, [id]: value }))}
                startDate={startDate()}
                user={u()}
                values={customFieldInputs()}
              />
              <Show when={store.resources.profileFieldDefs.error}>
                <div class="user-profile-fields-warning flex-between">
                  <span>Additional profile fields are unavailable.</span>
                  <Button
                    disabled={store.resources.profileFieldDefs.isFetching}
                    onClick={() => void store.resources.retryProfileFieldDefs()}
                    size="sm"
                  >
                    {store.resources.profileFieldDefs.isFetching ? "Retrying…" : "Try again"}
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
