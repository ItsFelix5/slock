import type { UserStatus } from "@slock/slack-api";
import { Avatar, DEFAULT_AVATAR_COLOR } from "@slock/ui";
export function MessageAvatarButton(props: {
  color?: string;
  name: string;
  src?: string;
  userId: string;
  onClick: () => void;
  tabbable?: boolean;
}) {
  return (
    <button
      aria-label={`View ${props.name}`}
      class="message-avatar-button btn-reset flex-center"
      onClick={props.onClick}
      tabIndex={props.tabbable === false ? -1 : undefined}
      type="button"
    >
      <Avatar
        size="message"
        user={{
          avatarColor: props.color ?? DEFAULT_AVATAR_COLOR,
          avatarUrl: props.src,
          id: props.userId,
          name: props.name,
        }}
      />
    </button>
  );
}
export function MessageAuthorButton(props: {
  disabled: boolean;
  name: string;
  onClick: () => void;
  status?: UserStatus;
  tabbable?: boolean;
}) {
  return (
    <span
      aria-disabled={props.disabled}
      class="message-author btn-reset"
      classList={{ [`message-author-${props.status}`]: !!props.status }}
      onClick={() => {
        if (!props.disabled) props.onClick();
      }}
      onKeyDown={(event) => {
        if (props.disabled || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        props.onClick();
      }}
      tabIndex={props.disabled || props.tabbable === false ? -1 : 0}
    >
      {props.name}
    </span>
  );
}
