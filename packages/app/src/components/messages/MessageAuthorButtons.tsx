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
  // plain span, not a <button>: button content isn't a valid text-selection
  // anchor, so drag-selecting from the name into the message body made the
  // browser snap the selection to the nearest selectable spot outside the row
  return (
    // biome-ignore lint/a11y/useSemanticElements: must not be a <button> so it stays a text-selection anchor
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
      role="button"
      tabIndex={props.disabled ? -1 : 0}
    >
      {props.name}
    </span>
  );
}
