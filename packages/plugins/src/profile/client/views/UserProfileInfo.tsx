import { Mrkdwn } from "@slock/blockkit";
import { Slot, service } from "@slock/core/solid";
import type { User } from "@slock/types";
import { Icon } from "@slock/ui";
import { Show } from "solid-js";
import { AppBadge } from "../api/AppBadge";
import type { ProfileForm } from "./profileForm";
import UserProfileAvatar from "./UserProfileAvatar";
import UserProfileSelfFields from "./UserProfileSelfFields";
import UserProfileStatus from "./UserProfileStatus";

const dmsStore = service("dms");

export default function UserProfileInfo(props: {
  botBio: string | undefined;
  form: ProfileForm;
  isSelf: boolean;
  localTime: string | null;
  onPhotoSelected: (file: File) => void;
  tzSuffix: string;
  user: User;
}) {
  const u = () => props.user;
  const nickname = () => props.form.inputs.nickname;
  const realName = () => u().originalName ?? u().name;

  return (
    <>
      <UserProfileAvatar
        form={props.form}
        isSelf={props.isSelf}
        onPhotoSelected={props.onPhotoSelected}
        user={u()}
      />
      <Show fallback={<UserProfileSelfFields form={props.form} />} when={!props.isSelf}>
        <div class="user-profile-name">
          <input
            aria-label="Name"
            class="user-profile-name-input"
            data-commit-on-enter
            onBlur={props.form.commitNickname}
            onInput={(e) => props.form.setInput("nickname", e.currentTarget.value)}
            type="text"
            value={nickname() || realName()}
          />
          <Show when={u().isBot}>
            <AppBadge />
          </Show>
        </div>
        <Show when={!nickname().trim() && u().realName && u().realName !== u().name}>
          <p class="user-profile-original-name text-dim text-sm">Full name: {u().realName}</p>
        </Show>
        <Show when={nickname().trim() && nickname().trim() !== realName()}>
          <p class="user-profile-original-name text-dim text-sm">{realName()}</p>
        </Show>
        <Show when={u().title || props.botBio}>
          <p class="user-profile-title">
            <Show fallback={<Mrkdwn text={props.botBio ?? ""} />} when={u().title}>
              {u().title}
            </Show>
          </p>
        </Show>
        <Show when={u().isWorkspaceAdmin}>
          <p class="user-profile-title text-muted">
            Workspace {u().isWorkspaceOwner ? "Owner" : "Admin"}
          </p>
        </Show>
        <Show when={u().pronouns}>
          <p class="user-profile-title pronouns truncate">{u().pronouns}</p>
        </Show>
      </Show>
      <UserProfileStatus
        form={props.form}
        isSelf={props.isSelf}
        statusEmoji={props.isSelf ? props.form.inputs.statusEmoji : (u().statusEmoji ?? "")}
        statusText={props.isSelf ? props.form.inputs.statusText : (u().statusText ?? "")}
      />
      <Show when={props.localTime}>
        <p class="user-profile-meta text-muted text-sm">
          {props.localTime} local time{props.tzSuffix}
        </p>
      </Show>
      <Slot point="profile.meta" user={u()} />
      <Show when={!props.isSelf}>
        <div class="user-profile-actions">
          <button
            class="user-profile-message-btn flex-center busy"
            disabled={dmsStore.isOpenDmPending(u().id)}
            onClick={(e) => dmsStore.openDmWithUser(u().id, { split: e.shiftKey })}
            type="button"
          >
            <Icon name="direct-messages-filled" size={15} />
            {dmsStore.isOpenDmPending(u().id) ? "Opening…" : "Message"}
          </button>
        </div>
      </Show>
    </>
  );
}
