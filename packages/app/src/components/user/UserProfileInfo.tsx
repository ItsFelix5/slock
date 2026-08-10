import { Mrkdwn } from "@slock/blockkit";
import type { User } from "@slock/slack-api";
import { Icon } from "@slock/ui";
import { createEffect, Show } from "solid-js";
import { store } from "../../lib/store";
import UserProfileStatus from "./UserProfileStatus";

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
  statusText: () => string;
  setStatusText: (value: string) => void;
  statusEmoji: () => string;
  setStatusEmoji: (value: string) => void;
  savingStatus: () => boolean;
  saveStatus: () => Promise<void>;
  clearStatus: () => Promise<void>;
}

// Title grows to fit its content instead of scrolling horizontally like a
// normal single-line input — a title occasionally runs longer than the panel.
function autoGrowTitle(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export default function UserProfileInfo(props: UserProfileInfoProps) {
  // biome-ignore lint/style/noNonNullAssertion: user is guaranteed by parent Show
  const u = () => props.user()!;
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this through the JSX ref.
  let titleRef: HTMLTextAreaElement | undefined;
  createEffect(() => {
    props.titleInput();
    if (titleRef) autoGrowTitle(titleRef);
  });
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
            <textarea
              aria-label="Title"
              class="user-profile-title-input"
              disabled={props.savingProfileFields().title}
              onBlur={props.saveTitle}
              onInput={(e) => {
                props.setTitleInput(e.currentTarget.value);
                autoGrowTitle(e.currentTarget);
              }}
              onKeyDown={props.blurOnEnter}
              placeholder="Title"
              ref={titleRef}
              rows={1}
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
      <UserProfileStatus
        clearStatus={props.clearStatus}
        isSelf={props.isSelf}
        saveStatus={props.saveStatus}
        savingStatus={props.savingStatus}
        setStatusEmoji={props.setStatusEmoji}
        setStatusText={props.setStatusText}
        statusEmoji={() => (props.isSelf() ? props.statusEmoji() : (u().statusEmoji ?? ""))}
        statusText={() => (props.isSelf() ? props.statusText() : (u().statusText ?? ""))}
        blurOnEnter={props.blurOnEnter}
      />
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
