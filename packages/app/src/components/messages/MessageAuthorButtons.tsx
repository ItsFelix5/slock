// biome-ignore-all lint/style/useFilenamingConvention: This module intentionally groups the related author and avatar button exports.
import type { UserStatus } from "@slock/slack-api";
export function MessageAvatarButton(props: { color?: string; src?: string; onClick: () => void }) {
  return (
    <button
      class="message-avatar btn-reset flex-center"
      onClick={props.onClick}
      style={{ background: props.color ?? "#616061" }}
      type="button"
    >
      <span aria-hidden="true">?</span>
      <img
        alt=""
        class="message-avatar-img"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
        src={props.src}
      />
    </button>
  );
}
export function MessageAuthorButton(props: {
  disabled: boolean;
  name: string;
  onClick: () => void;
  status?: UserStatus;
}) {
  return (
    <button
      class="message-author btn-reset"
      classList={{ [`message-author-${props.status}`]: !!props.status }}
      disabled={props.disabled}
      onClick={props.onClick}
      type="button"
    >
      {props.name}
    </button>
  );
}
