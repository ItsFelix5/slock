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
