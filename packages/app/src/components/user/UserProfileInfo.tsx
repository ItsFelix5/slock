import { Mrkdwn } from "@slock/blockkit";
import type { User } from "@slock/slack-api";
import { Icon } from "@slock/ui";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { store } from "../../lib/store";
import AppBadge from "./AppBadge";
import UserProfileStatus from "./UserProfileStatus";
import { formatStartDate } from "./userProfileTime";

interface UserProfileInfoProps {
  isSelf: () => boolean;
  isSavingProfilePhoto: () => boolean;
  isSavingPresence: () => boolean;
  user: () => User | undefined;
  botBio: () => string | undefined;
  lastSeenText: () => string | null;
  localTime: () => string | null;
  onTogglePresence: () => void;
  onProfilePhotoSelected: (file: File) => void;
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
  startDate: () => string | undefined;
  savingStatus: () => boolean;
  saveStatus: () => Promise<void>;
  clearStatus: () => Promise<void>;
}

function autoGrowTitle(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export default function UserProfileInfo(props: UserProfileInfoProps) {
  const u = () => props.user()!;

  let titleRef: HTMLTextAreaElement | undefined;
  let titleResizeObserver: ResizeObserver | undefined;
  const [photoInputRef, setPhotoInputRef] = createSignal<HTMLInputElement>();
  createEffect(() => {
    props.titleInput();
    if (titleRef) autoGrowTitle(titleRef);
  });
  onCleanup(() => titleResizeObserver?.disconnect());
  return (
    <>
      <div class="user-profile-avatar-wrap">
        <Dynamic
          aria-busy={props.isSelf() ? props.isSavingProfilePhoto() : undefined}
          aria-label={
            props.isSelf()
              ? props.isSavingProfilePhoto()
                ? "Uploading profile photo"
                : "Change profile photo"
              : undefined
          }
          class="user-profile-avatar flex-center"
          classList={{ "is-editable": props.isSelf() }}
          component={props.isSelf() ? "button" : "div"}
          disabled={props.isSelf() ? props.isSavingProfilePhoto() : undefined}
          onClick={() => {
            if (!props.isSavingProfilePhoto()) photoInputRef()?.click();
          }}
          style={{ background: u().avatarColor }}
          type={props.isSelf() ? "button" : undefined}
        >
          <span aria-hidden="true">?</span>
          <img
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            src={u().avatarUrl}
          />
          <Show when={props.isSelf()}>
            <input
              accept="image/*"
              class="user-profile-photo-input"
              disabled={props.isSavingProfilePhoto()}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) props.onProfilePhotoSelected(file);
                event.currentTarget.value = "";
              }}
              ref={setPhotoInputRef}
              type="file"
            />
          </Show>
        </Dynamic>
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
            onClick={(event) => {
              event.stopPropagation();
              props.onTogglePresence();
            }}
            type="button"
          />
        </Show>
        <Show when={!props.isSelf() && u().presence}>
          <span
            aria-label={`${u().name} is ${u().presence}`}
            class="user-profile-presence"
            classList={{ away: u().presence === "away" }}
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
              ref={(el) => {
                titleRef = el;
                titleResizeObserver?.disconnect();
                titleResizeObserver = new ResizeObserver(() => autoGrowTitle(el));
                titleResizeObserver.observe(el.parentElement ?? el);
              }}
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
          <span class="user-profile-name-label">{u().name}</span>
          <Show when={u().isBot}>
            <AppBadge />
          </Show>
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
      <Show when={formatStartDate(props.startDate())}>
        <p class="user-profile-meta text-muted text-sm">
          Started {formatStartDate(props.startDate())}
        </p>
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
