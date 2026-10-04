import type { UserStatus } from "@slock/types";

export function MessageAuthorButton(props: {
  disabled: boolean;
  name: string;
  onClick: () => void;
  status?: UserStatus;
  tabbable?: boolean;
  truncate?: boolean;
}) {
  return (
    <button
      class="message-author btn-reset"
      classList={{
        truncate: props.truncate,
        disabled: props.disabled,
        [`message-author-${props.status}`]: !!props.status,
      }}
      onClick={() => {
        if (!props.disabled) props.onClick();
      }}
      tabIndex={props.disabled || props.tabbable === false ? -1 : 0}
      type="button"
    >
      {props.name}
    </button>
  );
}
