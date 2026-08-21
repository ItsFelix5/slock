import { Show } from "solid-js";
import type { User } from "../../../lib/api";
import { store } from "../../../lib/store";
import UserHoverCard from "../../user/UserHoverCard";
import { MessageAvatarButton } from "../message-author-buttons";

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
        <UserHoverCard userId={userId()}>
          <MessageAvatarButton
            color={props.user?.avatarColor}
            name={props.displayName}
            onClick={() => store.users.openUserProfile(userId())}
            src={props.avatarUrl}
            tabbable={props.focused}
            userId={userId()}
          />
        </UserHoverCard>
      )}
    </Show>
  );
}
