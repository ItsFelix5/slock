import { service } from "@slock/core/solid";
import type { User } from "@slock/types";
import { Show } from "solid-js";
import { MessageAvatarButton } from "../MessageAvatarButton";
import AuthorHoverCard from "./AuthorHoverCard";

const usersStore = service("users");

export default function MessageRowAvatar(props: {
  avatarUrl: string | undefined;
  displayName: string;
  fallbackUserId: string;
  focused: boolean;
  profileUserId: string | undefined;
  user: User | undefined;
}) {
  return (
    <Show
      fallback={
        <MessageAvatarButton
          color={props.user?.avatarColor}
          name={props.displayName}
          onClick={() => {}}
          src={props.avatarUrl}
          tabbable={props.focused}
          userId={props.fallbackUserId}
        />
      }
      when={props.profileUserId}
    >
      {(userId) => (
        <AuthorHoverCard userId={userId()}>
          <MessageAvatarButton
            color={props.user?.avatarColor}
            name={props.displayName}
            onClick={() => usersStore.openUserProfile(userId())}
            src={props.avatarUrl}
            tabbable={props.focused}
            userId={userId()}
          />
        </AuthorHoverCard>
      )}
    </Show>
  );
}
