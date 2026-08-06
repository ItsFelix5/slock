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
import UserProfileContact from "./UserProfileContact";
import UserProfileInfo from "./UserProfileInfo";
import UserProfileStatus from "./UserProfileStatus";
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
  const [statusExpiration, setStatusExpiration] = createSignal(0);
  const [savingStatus, setSavingStatus] = createSignal(false);
  const [savingPresence, setSavingPresence] = createSignal(false);
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
      setStatusExpiration(0);
      setNameInput(me.name);
      setTitleInput(me.title ?? "");
      setPronounsInput(me.pronouns ?? "");
      const defs = store.resources.profileFieldDefs() ?? [];
      setCustomFieldInputs(mergeMissingProfileFieldValues({}, defs, me.customFields ?? []));
    }),
  );
  createEffect(
    on(store.resources.profileFieldDefs, (defs) => {
      const me = store.users.currentUser();
      if (!(defs && me && user()?.id === me.id)) return;
      setCustomFieldInputs((current) =>
        mergeMissingProfileFieldValues(current, defs, me.customFields ?? []),
      );
    }),
  );
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
    const current = user()?.customFields?.find((f) => f.id === id)?.value ?? "";
    if (v === current) return;
    return saveProfileField(`custom:${id}`, () =>
      store.users.updateMyProfile({ customFields: { [id]: v } }),
    );
  };
  const statusExpirationTimestamp = (): number => {
    const sel = statusExpiration();
    if (sel === 0) return 0;
    if (sel === -1) return Math.floor(new Date().setHours(23, 59, 59, 999) / 1000);
    return Math.floor(Date.now() / 1000) + sel;
  };
  const saveStatus = async () => {
    if (savingStatus()) return;
    setSavingStatus(true);
    try {
      await store.users.updateMyStatus(statusText(), statusEmoji(), statusExpirationTimestamp());
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
        setStatusExpiration(0);
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
  const [now, setNow] = createSignal(Date.now());
  const clockTimer = setInterval(() => setNow(Date.now()), 60_000);
  onCleanup(() => clearInterval(clockTimer));
  const localTime = createLocalTime(user, now);
  const lastSeenText = createLastSeenText(user, now);
  const customFields = createMemo(() => {
    const defs = store.resources.profileFieldDefs();
    const values = user()?.customFields;
    if (!(defs && values?.length)) return [];
    const labelById = new Map(defs.map((d) => [d.id, d.label]));
    return values
      .map((f) => ({ ...f, label: labelById.get(f.id) }))
      .filter((f): f is typeof f & { label: string } => !!f.label);
  });
  const editableCustomFields = createMemo(() => store.resources.profileFieldDefs() ?? []);
  return (
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
              isSavingPresence={savingPresence}
              isSelf={isSelf}
              lastSeenText={lastSeenText}
              localTime={localTime}
              nameInput={nameInput}
              onTogglePresence={togglePresence}
              pronounsInput={pronounsInput}
              saveName={saveName}
              savePronouns={savePronouns}
              saveTitle={saveTitle}
              savingProfileFields={savingProfileFields}
              setNameInput={setNameInput}
              setPronounsInput={setPronounsInput}
              setTitleInput={setTitleInput}
              titleInput={titleInput}
              user={user}
            />
            <Show when={isSelf()}>
              <UserProfileStatus
                clearStatus={clearStatus}
                saveStatus={saveStatus}
                setStatusEmoji={setStatusEmoji}
                setStatusExpiration={setStatusExpiration}
                setStatusText={setStatusText}
                statusEmoji={statusEmoji}
                statusExpiration={statusExpiration}
                statusText={statusText}
                savingStatus={savingStatus}
              />
            </Show>
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
  );
}
