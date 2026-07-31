import { EmojiText, Mrkdwn } from "@slock/blockkit";
import {
  Button,
  Icon,
  InlineFeedback,
  PanelHeader,
  Popover,
  ResizeHandle,
  useEscapeClose,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { actionFeedback, store } from "../../lib/store";
import EmojiPicker from "../composer/popovers/EmojiPicker";
import "../settings/Settings.css";
import "./UserProfile.css";
import UserProfileContact from "./UserProfileContact";
import { mergeMissingProfileFieldValues } from "./userProfileFieldValues";
import {
  blurOnEnter,
  DEFAULT_WIDTH,
  EXPIRATION_OPTIONS,
  MAX_WIDTH,
  MIN_WIDTH,
} from "./userProfileOptions";
import { createLocalTime } from "./userProfileTime";
export default function UserProfile() {
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);
  const [nameInput, setNameInput] = createSignal("");
  const [titleInput, setTitleInput] = createSignal("");
  const [pronounsInput, setPronounsInput] = createSignal("");
  const [customFieldInputs, setCustomFieldInputs] = createSignal<Record<string, string>>({});
  const [statusText, setStatusText] = createSignal("");
  const [statusEmoji, setStatusEmoji] = createSignal("");
  const [statusExpiration, setStatusExpiration] = createSignal(0);
  const [emojiOpen, setEmojiOpen] = createSignal(false);
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
    setEmojiOpen(false);
    setSavingStatus(true);
    try {
      await store.users.updateMyStatus(statusText(), statusEmoji(), statusExpirationTimestamp());
    } finally {
      setSavingStatus(false);
    }
  };
  const clearStatus = async () => {
    if (savingStatus()) return;
    setEmojiOpen(false);
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
        <div class="user-profile-panel" style={{ width: `${width()}px` }}>
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
            <div class="user-profile-avatar flex-center" style={{ background: u().avatarColor }}>
              <span aria-hidden="true">?</span>
              <img
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
                src={u().avatarUrl}
              />
              <Show
                fallback={
                  <span
                    aria-label={`${u().name} is ${u().presence}`}
                    class="user-profile-presence"
                    classList={{ away: u().presence === "away" }}
                    role="img"
                  />
                }
                when={isSelf()}
              >
                <button
                  aria-busy={savingPresence()}
                  aria-label={
                    savingPresence()
                      ? "Updating presence"
                      : u().presence === "away"
                        ? "Set yourself active"
                        : "Set yourself away"
                  }
                  class="user-profile-presence"
                  classList={{ away: u().presence === "away" }}
                  disabled={savingPresence()}
                  onClick={togglePresence}
                  type="button"
                />
              </Show>
            </div>
            <Show
              fallback={
                <div class="user-profile-edit-name">
                  <input
                    aria-label="Display name"
                    class="user-profile-name-input"
                    disabled={savingProfileFields().name}
                    onBlur={saveName}
                    onInput={(e) => setNameInput(e.currentTarget.value)}
                    onKeyDown={blurOnEnter}
                    type="text"
                    value={nameInput()}
                  />
                  <input
                    aria-label="Title"
                    class="user-profile-title-input"
                    disabled={savingProfileFields().title}
                    onBlur={saveTitle}
                    onInput={(e) => setTitleInput(e.currentTarget.value)}
                    onKeyDown={blurOnEnter}
                    placeholder="Title"
                    type="text"
                    value={titleInput()}
                  />
                  <input
                    aria-label="Pronouns"
                    class="user-profile-pronouns-input"
                    disabled={savingProfileFields().pronouns}
                    onBlur={savePronouns}
                    onInput={(e) => setPronounsInput(e.currentTarget.value)}
                    onKeyDown={blurOnEnter}
                    placeholder="Pronouns"
                    type="text"
                    value={pronounsInput()}
                  />
                </div>
              }
              when={!isSelf()}
            >
              <h2 class="user-profile-name">
                <span class="user-profile-name-label">
                  {u().name}
                  {u().isBot ? " (bot)" : ""}
                </span>
                <Show when={u().pronouns}>
                  <span class="pronouns">({u().pronouns})</span>
                </Show>
              </h2>
              <Show when={u().title || botBio()}>
                <p class="user-profile-title text-muted">
                  <Show fallback={<Mrkdwn text={botBio() ?? ""} />} when={u().title}>
                    {u().title}
                  </Show>
                </p>
              </Show>
            </Show>
            <Show when={u().statusText}>
              <p class="user-profile-status flex-align-center">
                <Show when={u().statusEmoji}>{(emoji) => <EmojiText text={emoji()} />}</Show>
                {u().statusText}
              </p>
            </Show>
            <Show when={localTime()}>
              <p class="user-profile-meta text-muted text-sm">
                {localTime()} local time{u().tzLabel ? ` (${u().tzLabel})` : ""}
              </p>
            </Show>
            <Show when={!isSelf()}>
              <div class="user-profile-actions">
                <button
                  class="user-profile-message-btn flex-center"
                  disabled={store.dms.isOpenDmPending(u().id)}
                  onClick={() => store.dms.openDmWithUser(u().id)}
                  type="button"
                >
                  <Icon name="direct-messages-filled" size={15} />
                  {store.dms.isOpenDmPending(u().id) ? "Opening…" : "Message"}
                </button>
              </div>
            </Show>
            <Show when={isSelf()}>
              <div class="user-profile-section">
                <h3 class="user-profile-section-title">Status</h3>
                <div class="settings-status-row flex-align-center">
                  <Popover
                    onClose={() => setEmojiOpen(false)}
                    open={emojiOpen()}
                    trigger={
                      <button
                        class="settings-status-emoji-btn btn-reset flex-center"
                        disabled={savingStatus()}
                        onClick={() => setEmojiOpen(!emojiOpen())}
                        type="button"
                      >
                        <Show fallback="⛔" when={statusEmoji()}>
                          <EmojiText text={statusEmoji()} />
                        </Show>
                      </button>
                    }
                  >
                    <EmojiPicker
                      onClose={() => setEmojiOpen(false)}
                      onSelect={(name) => {
                        setStatusEmoji(`:${name}:`);
                        setEmojiOpen(false);
                      }}
                    />
                  </Popover>
                  <input
                    class="settings-status-input"
                    disabled={savingStatus()}
                    onInput={(e) => setStatusText(e.currentTarget.value)}
                    placeholder="What's your status?"
                    type="text"
                    value={statusText()}
                  />
                </div>
                <select
                  class="settings-status-expiration"
                  disabled={savingStatus()}
                  onChange={(e) => setStatusExpiration(Number(e.currentTarget.value))}
                  value={statusExpiration()}
                >
                  <For each={EXPIRATION_OPTIONS}>
                    {(opt) => <option value={opt.seconds}>{opt.label}</option>}
                  </For>
                </select>
                <div class="settings-status-actions flex-align-center">
                  <button
                    class="settings-status-save btn-reset"
                    disabled={savingStatus()}
                    onClick={saveStatus}
                    type="button"
                  >
                    {savingStatus() ? "Saving…" : "Save status"}
                  </button>
                  <Show when={statusText() || statusEmoji()}>
                    <button
                      class="settings-status-clear btn-reset"
                      disabled={savingStatus()}
                      onClick={clearStatus}
                      type="button"
                    >
                      Clear
                    </button>
                  </Show>
                </div>
              </div>
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
