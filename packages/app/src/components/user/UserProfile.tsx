import { EmojiText } from "@slock/blockkit";
import { Icon, Pronouns, ResizeHandle, useEscapeClose } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
  closeUserProfile,
  currentUser,
  openDmWithUser,
  profileFieldDefs,
  profileUserId,
  userById,
} from "../../lib/store";
import Settings from "../settings/Settings";
import "./UserProfile.css";

const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 280;
const MAX_WIDTH = 480;

export default function UserProfile() {
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);
  useEscapeClose(() => (settingsOpen() ? setSettingsOpen(false) : closeUserProfile()));

  const user = createMemo(() => {
    const id = profileUserId();
    return id ? userById(id) : undefined;
  });

  const isSelf = createMemo(() => user()?.id === currentUser()?.id);

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
            <h2 class="user-profile-name">
              {u().name}
              {u().isBot ? " (bot)" : ""}
              <Pronouns text={u().pronouns} />
            </h2>
            <Show when={u().title}>
              <p class="user-profile-title">{u().title}</p>
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
            <div class="user-profile-actions">
              <Show
                when={!isSelf()}
                fallback={
                  <button
                    type="button"
                    class="user-profile-message-btn"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Icon name="ellipsis-vertical-filled" size={15} />
                    Settings
                  </button>
                }
              >
                <button
                  type="button"
                  class="user-profile-message-btn"
                  onClick={() => openDmWithUser(u().id)}
                >
                  <Icon name="direct-messages-filled" size={15} />
                  Message
                </button>
              </Show>
            </div>

            <Show when={u().email || u().phone || customFields().length > 0}>
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
              </div>
            </Show>
          </div>
          <Show when={settingsOpen()}>
            <Settings onClose={() => setSettingsOpen(false)} />
          </Show>
        </div>
      )}
    </Show>
  );
}
