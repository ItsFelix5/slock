import { EmojiText } from "@slock/blockkit";
import { Icon, Popover, ResizeHandle, SegmentedControl, useEscapeClose } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import {
  clearMyStatus,
  closeUserProfile,
  currentUser,
  openDmWithUser,
  profileFieldDefs,
  profileUserId,
  updateMyPresence,
  updateMyProfile,
  updateMyStatus,
  userById,
} from "../../lib/store";
import EmojiPicker from "../composer/EmojiPicker";
import "../settings/Settings.css";
import "./UserProfile.css";

const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 280;
const MAX_WIDTH = 480;

const EXPIRATION_OPTIONS = [
  { label: "Don't clear", seconds: 0 },
  { label: "30 minutes", seconds: 30 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "4 hours", seconds: 4 * 60 * 60 },
  { label: "Today", seconds: -1 },
];

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

  useEscapeClose(closeUserProfile);

  const user = createMemo(() => {
    const id = profileUserId();
    return id ? userById(id) : undefined;
  });

  const isSelf = createMemo(() => user()?.id === currentUser()?.id);

  // Own-profile form fields are only ever seeded when the panel switches to
  // showing *your* profile (not on every store update — a websocket presence
  // tick shouldn't blow away text you're mid-typing).
  createEffect(
    on(profileUserId, (id) => {
      const me = currentUser();
      if (!id || id !== me?.id) return;
      setStatusText(me.statusText ?? "");
      setStatusEmoji(me.statusEmoji ?? "");
      setStatusExpiration(0);
      setNameInput(me.name);
      setTitleInput(me.title ?? "");
      setPronounsInput(me.pronouns ?? "");
      const defs = profileFieldDefs() ?? [];
      const valueById = new Map((me.customFields ?? []).map((f) => [f.id, f.value]));
      setCustomFieldInputs(Object.fromEntries(defs.map((d) => [d.id, valueById.get(d.id) ?? ""])));
    }),
  );

  const saveName = async () => {
    const v = nameInput().trim();
    if (!v || v === user()?.name) return;
    await updateMyProfile({ displayName: v });
  };

  const saveTitle = async () => {
    const v = titleInput().trim();
    if (v === (user()?.title ?? "")) return;
    await updateMyProfile({ title: v });
  };

  const savePronouns = async () => {
    const v = pronounsInput().trim();
    if (v === (user()?.pronouns ?? "")) return;
    await updateMyProfile({ pronouns: v });
  };

  const saveCustomField = async (id: string) => {
    const v = (customFieldInputs()[id] ?? "").trim();
    const current = user()?.customFields?.find((f) => f.id === id)?.value ?? "";
    if (v === current) return;
    await updateMyProfile({ customFields: { [id]: v } });
  };

  const blurOnEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter") (e.currentTarget as HTMLElement).blur();
  };

  const statusExpirationTimestamp = (): number => {
    const sel = statusExpiration();
    if (sel === 0) return 0;
    if (sel === -1) return Math.floor(new Date().setHours(23, 59, 59, 999) / 1000);
    return Math.floor(Date.now() / 1000) + sel;
  };

  const saveStatus = async () => {
    setSavingStatus(true);
    await updateMyStatus(statusText(), statusEmoji(), statusExpirationTimestamp());
    setSavingStatus(false);
  };

  const clearStatus = async () => {
    setStatusText("");
    setStatusEmoji("");
    await clearMyStatus();
  };

  const localTime = createMemo(() => {
    const tz = user()?.tz;
    if (!tz) return null;
    try {
      return new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
      });
    } catch {
      return null;
    }
  });

  // Custom-field values (keyed by field id, from the user's own profile) only
  // have meaning once joined against the workspace's field *definitions*
  // (team.profile.get, fetched once — see store.ts's profileFieldDefs). Fields
  // the workspace has since hidden/deleted have no matching def and are skipped.
  const customFields = createMemo(() => {
    const defs = profileFieldDefs();
    const values = user()?.customFields;
    if (!defs || !values?.length) return [];
    const labelById = new Map(defs.map((d) => [d.id, d.label]));
    return values
      .map((f) => ({ ...f, label: labelById.get(f.id) }))
      .filter((f): f is typeof f & { label: string } => !!f.label);
  });

  // For self, every field definition the workspace has is shown (even ones
  // with no value yet) so there's somewhere to fill them in.
  const editableCustomFields = createMemo(() => profileFieldDefs() ?? []);

  return (
    <Show when={user()}>
      {(u) => (
        <div class="user-profile-panel" style={{ width: `${width()}px` }}>
          <ResizeHandle
            width={width}
            setWidth={setWidth}
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            direction={-1}
            side="left"
          />
          <div class="user-profile-header">
            <div class="user-profile-header-title">Profile</div>
            <button
              type="button"
              class="user-profile-close"
              onClick={closeUserProfile}
              title="Close"
            >
              ✕
            </button>
          </div>
          <div class="user-profile-body">
            <div class="user-profile-avatar" style={{ background: u().avatarColor }}>
              <Show when={u().avatarUrl} fallback={u().initials}>
                {(url) => <img src={url()} alt="" />}
              </Show>
              <span class="user-profile-presence" classList={{ away: u().presence === "away" }} />
            </div>
            <Show
              when={!isSelf()}
              fallback={
                <div class="user-profile-edit-name">
                  <input
                    class="user-profile-name-input"
                    type="text"
                    value={nameInput()}
                    onInput={(e) => setNameInput(e.currentTarget.value)}
                    onBlur={saveName}
                    onKeyDown={blurOnEnter}
                    aria-label="Display name"
                  />
                  <input
                    class="user-profile-title-input"
                    type="text"
                    placeholder="Title"
                    value={titleInput()}
                    onInput={(e) => setTitleInput(e.currentTarget.value)}
                    onBlur={saveTitle}
                    onKeyDown={blurOnEnter}
                    aria-label="Title"
                  />
                  <input
                    class="user-profile-pronouns-input"
                    type="text"
                    placeholder="Pronouns"
                    value={pronounsInput()}
                    onInput={(e) => setPronounsInput(e.currentTarget.value)}
                    onBlur={savePronouns}
                    onKeyDown={blurOnEnter}
                    aria-label="Pronouns"
                  />
                </div>
              }
            >
              <h2 class="user-profile-name">
                {u().name}
                {u().isBot ? " (bot)" : ""}
                <Show when={u().pronouns}>
                  <span class="pronouns">({u().pronouns})</span>
                </Show>
              </h2>
              <Show when={u().title}>
                <p class="user-profile-title">{u().title}</p>
              </Show>
            </Show>
            <Show when={u().statusText}>
              <p class="user-profile-status">
                <Show when={u().statusEmoji}>{(emoji) => <EmojiText text={emoji()} />}</Show>
                {u().statusText}
              </p>
            </Show>
            <Show when={localTime()}>
              <p class="user-profile-meta">
                {localTime()} local time{u().tzLabel ? ` (${u().tzLabel})` : ""}
              </p>
            </Show>
            <Show when={!isSelf()}>
              <div class="user-profile-actions">
                <button
                  type="button"
                  class="user-profile-message-btn"
                  onClick={() => openDmWithUser(u().id)}
                >
                  <Icon name="direct-messages-filled" size={15} />
                  Message
                </button>
              </div>
            </Show>

            <Show when={isSelf()}>
              <div class="user-profile-section">
                <h3 class="user-profile-section-title">Status</h3>
                <div class="settings-status-row">
                  <Popover
                    open={emojiOpen()}
                    onClose={() => setEmojiOpen(false)}
                    trigger={
                      <button
                        type="button"
                        class="settings-status-emoji-btn"
                        onClick={() => setEmojiOpen(!emojiOpen())}
                      >
                        <Show when={statusEmoji()} fallback="🙂">
                          <EmojiText text={statusEmoji()} />
                        </Show>
                      </button>
                    }
                  >
                    <EmojiPicker
                      onSelect={(name) => {
                        setStatusEmoji(`:${name}:`);
                        setEmojiOpen(false);
                      }}
                      onClose={() => setEmojiOpen(false)}
                    />
                  </Popover>
                  <input
                    class="settings-status-input"
                    type="text"
                    placeholder="What's your status?"
                    value={statusText()}
                    onInput={(e) => setStatusText(e.currentTarget.value)}
                  />
                </div>
                <select
                  class="settings-status-expiration"
                  value={statusExpiration()}
                  onChange={(e) => setStatusExpiration(Number(e.currentTarget.value))}
                >
                  {EXPIRATION_OPTIONS.map((opt) => (
                    <option value={opt.seconds}>{opt.label}</option>
                  ))}
                </select>
                <div class="settings-status-actions">
                  <button
                    type="button"
                    class="settings-status-save"
                    onClick={saveStatus}
                    disabled={savingStatus()}
                  >
                    {savingStatus() ? "Saving…" : "Save status"}
                  </button>
                  <Show when={statusText() || statusEmoji()}>
                    <button type="button" class="settings-status-clear" onClick={clearStatus}>
                      Clear
                    </button>
                  </Show>
                </div>
              </div>

              <div class="settings-row">
                <div>
                  <div class="settings-row-label">Presence</div>
                  <div class="settings-row-hint">Manually mark yourself away.</div>
                </div>
                <SegmentedControl>
                  <button
                    type="button"
                    class="segmented-control-btn"
                    classList={{ active: u().presence !== "away" }}
                    onClick={() => updateMyPresence("auto")}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    class="segmented-control-btn"
                    classList={{ active: u().presence === "away" }}
                    onClick={() => updateMyPresence("away")}
                  >
                    Away
                  </button>
                </SegmentedControl>
              </div>
            </Show>

            <Show when={u().email || u().phone || customFields().length > 0 || isSelf()}>
              <div class="user-profile-section">
                <h3 class="user-profile-section-title">Contact information</h3>
                <Show when={u().email}>
                  <div class="user-profile-field">
                    <div class="user-profile-field-label">Email</div>
                    <a
                      class="user-profile-field-value user-profile-field-link"
                      href={`mailto:${u().email}`}
                    >
                      {u().email}
                    </a>
                  </div>
                </Show>
                <Show when={u().phone}>
                  <div class="user-profile-field">
                    <div class="user-profile-field-label">Phone</div>
                    <div class="user-profile-field-value">{u().phone}</div>
                  </div>
                </Show>

                <Show
                  when={!isSelf()}
                  fallback={
                    <For each={editableCustomFields()}>
                      {(def) => (
                        <div class="user-profile-field">
                          <label class="user-profile-field-label" for={`profile-field-${def.id}`}>
                            {def.label}
                          </label>
                          <input
                            id={`profile-field-${def.id}`}
                            class="user-profile-field-input"
                            type="text"
                            value={customFieldInputs()[def.id] ?? ""}
                            onInput={(e) =>
                              setCustomFieldInputs((prev) => ({
                                ...prev,
                                [def.id]: e.currentTarget.value,
                              }))
                            }
                            onBlur={() => saveCustomField(def.id)}
                            onKeyDown={blurOnEnter}
                          />
                        </div>
                      )}
                    </For>
                  }
                >
                  <For each={customFields()}>
                    {(f) => (
                      <div class="user-profile-field">
                        <div class="user-profile-field-label">{f.label}</div>
                        <Show
                          when={/^https?:\/\//.test(f.value)}
                          fallback={<div class="user-profile-field-value">{f.alt || f.value}</div>}
                        >
                          <a
                            class="user-profile-field-value user-profile-field-link"
                            href={f.value}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {f.alt || f.value}
                          </a>
                        </Show>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}
