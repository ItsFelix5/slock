import { Mrkdwn } from "@slock/blockkit";
import { AvatarImage, Icon } from "@slock/ui";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { User } from "../../lib/api";
import { store } from "../../lib/store";
import { AppBadge } from "./AppBadge";
import UserProfileStatus from "./UserProfileStatus";

interface UserProfileInfoProps {
  isSelf: () => boolean;
  isSavingProfilePhoto: () => boolean;
  isSavingPresence: () => boolean;
  user: () => User;
  botBio: () => string | undefined;
  lastSeenText: () => string | null;
  localTime: () => string | null;
  onTogglePresence: () => void;
  onProfilePhotoSelected: (file: File) => void;
  saveName: () => void;
  saveTitle: () => void;
  savePronouns: () => void;
  saveNickname: () => void;
  nameInput: () => string;
  setNameInput: (value: string) => void;
  titleInput: () => string;
  setTitleInput: (value: string) => void;
  pronounsInput: () => string;
  setPronounsInput: (value: string) => void;
  nicknameInput: () => string;
  setNicknameInput: (value: string) => void;
  savingProfileFields: () => Record<string, boolean>;
  blurOnEnter: (e: KeyboardEvent & { currentTarget: HTMLElement }) => void;
  statusText: () => string;
  setStatusText: (value: string) => void;
  statusEmoji: () => string;
  setStatusEmoji: (value: string) => void;
  savingStatus: () => boolean;
  saveStatus: () => Promise<void>;
  clearStatus: () => Promise<void>;
}

function autoGrowTitle(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export default function UserProfileInfo(props: UserProfileInfoProps) {
  const u = props.user;

  let titleRef: HTMLTextAreaElement | undefined;
  const [photoInputRef, setPhotoInputRef] = createSignal<HTMLInputElement>();
  createEffect(() => {
    props.titleInput();
    if (titleRef) autoGrowTitle(titleRef);
  });
  const onWindowResize = () => titleRef && autoGrowTitle(titleRef);
  window.addEventListener("resize", onWindowResize);
  onCleanup(() => window.removeEventListener("resize", onWindowResize));
  const onWindowPaste = (event: ClipboardEvent) => {
    if (!props.isSelf() || props.isSavingProfilePhoto()) return;
    const target = event.target;
    if (target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
    const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
      i.type.startsWith("image/"),
    );
    const file = item?.getAsFile();
    if (file) props.onProfilePhotoSelected(file);
  };
  window.addEventListener("paste", onWindowPaste);
  onCleanup(() => window.removeEventListener("paste", onWindowPaste));
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
          <AvatarImage avatarUrl={u().avatarUrl} />
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
                autoGrowTitle(el);
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
        <div class="user-profile-name">
          <input
            aria-label="Name"
            class="user-profile-name-input"
            onBlur={props.saveNickname}
            onInput={(e) => props.setNicknameInput(e.currentTarget.value)}
            onKeyDown={props.blurOnEnter}
            type="text"
            value={props.nicknameInput() || (u().originalName ?? u().name)}
          />
          <Show when={u().isBot}>
            <AppBadge />
          </Show>
          <Show when={!props.nicknameInput().trim() && u().realName && u().realName !== u().name}>
            <span class="text-dim text-sm">({u().realName})</span>
          </Show>
        </div>
        <Show
          when={
            props.nicknameInput().trim() &&
            props.nicknameInput().trim() !== (u().originalName ?? u().name)
          }
        >
          <p class="user-profile-original-name text-dim text-sm">{u().originalName ?? u().name}</p>
        </Show>
        <Show when={u().title || props.botBio()}>
          <p class="user-profile-title">
            <Show fallback={<Mrkdwn text={props.botBio() ?? ""} />} when={u().title}>
              {u().title}
            </Show>
          </p>
        </Show>
        <Show when={u().pronouns}>
          <p class="user-profile-title pronouns">{u().pronouns}</p>
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
            onClick={(e) => store.dms.openDmWithUser(u().id, { split: e.shiftKey })}
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
