import {
  Button,
  InlineFeedback,
  PanelHeader,
  panelWantsFullscreen,
  ResizeHandle,
  useEscapeClose,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js";
import { sidebarWidth } from "../../lib/sidebarWidth";
import { actionFeedback, store } from "../../lib/store";
import "../settings/Settings.css";
import "./UserProfile.css";
import ProfilePhotoEditor from "./ProfilePhotoEditor";
import UserProfileContact from "./UserProfileContact";
import UserProfileInfo from "./UserProfileInfo";
import { mergeMissingProfileFieldValues } from "./userProfileFieldValues";
import { blurOnEnter, DEFAULT_WIDTH, MAX_WIDTH, MIN_WIDTH } from "./userProfileOptions";
import { createLastSeenText, createLocalTime } from "./userProfileTime";
export default function UserProfile() {
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);
  const isFullscreen = createMemo(() => panelWantsFullscreen(sidebarWidth(), width()));
  const [nameInput, setNameInput] = createSignal("");
  const [titleInput, setTitleInput] = createSignal("");
  const [pronounsInput, setPronounsInput] = createSignal("");
  const [customFieldInputs, setCustomFieldInputs] = createSignal<Record<string, string>>({});
  const [statusText, setStatusText] = createSignal("");
  const [statusEmoji, setStatusEmoji] = createSignal("");
  const [savingStatus, setSavingStatus] = createSignal(false);
  const [savingPresence, setSavingPresence] = createSignal(false);
  const [savingProfilePhoto, setSavingProfilePhoto] = createSignal(false);
  const [photoToEdit, setPhotoToEdit] = createSignal<File>();
  const [savingProfileFields, setSavingProfileFields] = createSignal<Record<string, boolean>>({});
  useEscapeClose(store.users.closeUserProfile, () => !!store.users.profileUserId());
  const user = createMemo(() => {
    const id = store.users.profileUserId();
    return id ? store.users.userById(id) : undefined;
  });
  const isSelf = createMemo(() => user()?.id === store.users.currentUser()?.id);
  const botBio = createMemo(() =>
    user()?.isBot ? store.users.botBio(user()?.appId, user()?.botId) : undefined,
  );
  createEffect(() => {
    if (store.users.profileUserId()) store.resources.loadProfileFieldDefs();
  });
  createEffect(
    on(store.users.profileUserId, (id) => {
      const me = store.users.currentUser();
      if (!id || id !== me?.id) return;
      setStatusText(me.statusText ?? "");
      setStatusEmoji(me.statusEmoji ?? "");
      setNameInput(me.name);
      setTitleInput(me.title ?? "");
      setPronounsInput(me.pronouns ?? "");
    }),
  );
  // Custom field values live in customFieldsFor (fetched separately — see
  // the store), not on the user object, and arrive async — so backfill any
  // inputs still missing once either that fetch or profileFieldDefs resolves.
  // fields is undefined until the fetch actually resolves (see customFieldsFor);
  // merging that as "no values" would permanently mark every field as already
  // handled and lock out the real values once they do arrive.
  createEffect(() => {
    const defs = store.resources.profileFieldDefs();
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
  const lastSeenText = createLastSeenText(user, now);
  const customFields = createMemo(() => {
    const defs = store.resources.profileFieldDefs();
    const id = user()?.id;
    const values = id ? store.users.customFieldsFor(id) : undefined;
    if (!(defs && values?.length)) return [];
    const labelById = new Map(defs.map((d) => [d.id, d.label]));
    return values
      .map((f) => ({ ...f, label: labelById.get(f.id) }))
      .filter((f): f is typeof f & { label: string } => !!f.label);
  });
  const editableCustomFields = createMemo(() => store.resources.profileFieldDefs() ?? []);
  return (
    <>
      <Show when={user()}>
        {(u) => (
          <div
            class="user-profile-panel"
            classList={{ "panel-fullscreen": isFullscreen() }}
            style={{ width: `${width()}px` }}
          >
            <ResizeHandle
              direction={-1}
              label="Resize profile panel"
              max={MAX_WIDTH}
              min={MIN_WIDTH}
              setWidth={setWidth}
              side="left"
              width={width}
            />
            <PanelHeader onClose={store.users.closeUserProfile} title="Profile" />
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
                onProfilePhotoSelected={setPhotoToEdit}
                onTogglePresence={togglePresence}
                pronounsInput={pronounsInput}
                saveName={saveName}
                savePronouns={savePronouns}
                saveStatus={saveStatus}
                saveTitle={saveTitle}
                savingProfileFields={savingProfileFields}
                savingStatus={savingStatus}
                setNameInput={setNameInput}
                setPronounsInput={setPronounsInput}
                setStatusEmoji={setStatusEmoji}
                setStatusText={setStatusText}
                setTitleInput={setTitleInput}
                statusEmoji={statusEmoji}
                statusText={statusText}
                titleInput={titleInput}
                user={user}
              />
              <UserProfileContact
                customFields={customFields()}
                editableFields={editableCustomFields()}
                isSelf={isSelf()}
                isSavingField={(id) => !!savingProfileFields()[`custom:${id}`]}
                onKeyDown={blurOnEnter}
                saveField={saveCustomField}
                setValue={(id, value) => setCustomFieldInputs((prev) => ({ ...prev, [id]: value }))}
                user={u()}
                values={customFieldInputs()}
              />
              <Show when={store.resources.profileFieldDefs.error}>
                <div class="user-profile-fields-warning flex-between" role="alert">
                  <span>Additional profile fields are unavailable.</span>
                  <Button
                    disabled={store.resources.profileFieldDefs.loading}
                    onClick={() => void store.resources.retryProfileFieldDefs()}
                    size="sm"
                    variant="ghost"
                  >
                    {store.resources.profileFieldDefs.loading ? "Retrying…" : "Try again"}
                  </Button>
                </div>
              </Show>
            </div>
          </div>
        )}
      </Show>
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
