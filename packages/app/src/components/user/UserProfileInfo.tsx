import { EmojiText, Mrkdwn } from "@slock/blockkit";
import type { User } from "@slock/slack-api";
import { Icon } from "@slock/ui";
import { Show } from "solid-js";
import { store } from "../../lib/store";

interface UserProfileInfoProps {
  isSelf: () => boolean;
  isSavingPresence: () => boolean;
  user: () => User | undefined;
  botBio: () => string | undefined;
  lastSeenText: () => string | null;
  localTime: () => string | null;
  onTogglePresence: () => void;
  saveName: () => void;
  saveTitle: () => void;
  savePronouns: () => void;
  nameInput: () => string;
  setNameInput: (value: string) => void;
  titleInput: () => string;
  setTitleInput: (value: string) => void;
  pronounsInput: () => string;
  setPronounsInput: (value: string) => void;
  savingProfileFields: () => Record<string, boolean>;
  blurOnEnter: (e: KeyboardEvent) => void;
}

export default function UserProfileInfo(props: UserProfileInfoProps) {
  // biome-ignore lint/style/noNonNullAssertion: user is guaranteed by parent Show
  const u = () => props.user()!;
  return (
    <>
      <div class="user-profile-avatar flex-center" style={{ background: u().avatarColor }}>
        <span aria-hidden="true">?</span>
        <img
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          src={u().avatarUrl}
        />
        <Show when={props.isSelf()}>
          <button
            aria-busy={props.isSavingPresence()}
            aria-label={
              props.isSavingPresence()
                ? "Updating presence"
                : u().presence === "away"
                  ? "Set yourself active"
                  : "Set yourself away"
            }
            class="user-profile-presence"
            classList={{ away: u().presence === "away" }}
            disabled={props.isSavingPresence()}
            onClick={props.onTogglePresence}
            type="button"
          />
        </Show>
        <Show when={!props.isSelf() && u().presence}>
          <span
            aria-label={`${u().name} is ${u().presence}`}
            class="user-profile-presence"
            classList={{ away: u().presence === "away" }}
            role="img"
          />
        </Show>
      </div>
      <Show
        fallback={
          <div class="user-profile-edit-name">
            <input
              aria-label="Display name"
              class="user-profile-name-input"
              disabled={props.savingProfileFields().name}
              onBlur={props.saveName}
              onInput={(e) => props.setNameInput(e.currentTarget.value)}
              onKeyDown={props.blurOnEnter}
              type="text"
              value={props.nameInput()}
            />
            <input
              aria-label="Title"
              class="user-profile-title-input"
              disabled={props.savingProfileFields().title}
              onBlur={props.saveTitle}
              onInput={(e) => props.setTitleInput(e.currentTarget.value)}
              onKeyDown={props.blurOnEnter}
              placeholder="Title"
              type="text"
              value={props.titleInput()}
            />
            <input
              aria-label="Pronouns"
              class="user-profile-pronouns-input"
              disabled={props.savingProfileFields().pronouns}
              onBlur={props.savePronouns}
              onInput={(e) => props.setPronounsInput(e.currentTarget.value)}
              onKeyDown={props.blurOnEnter}
              placeholder="Pronouns"
              type="text"
              value={props.pronounsInput()}
            />
          </div>
        }
        when={!props.isSelf()}
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
        <Show when={u().title || props.botBio()}>
          <p class="user-profile-title text-muted">
            <Show fallback={<Mrkdwn text={props.botBio() ?? ""} />} when={u().title}>
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
      <Show when={props.localTime()}>
        <p class="user-profile-meta text-muted text-sm">
          {props.localTime()} local time{u().tzLabel ? ` (${u().tzLabel})` : ""}
        </p>
      </Show>
      <Show when={props.lastSeenText()}>
        <p class="user-profile-meta text-muted text-sm">Last seen {props.lastSeenText()}</p>
      </Show>
      <Show when={!props.isSelf()}>
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
    </>
  );
}
