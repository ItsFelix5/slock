export function MessageAuthorButton(props: {
  class?: string;
  disabled: boolean;
  name: string;
  onClick: () => void;
  tabbable?: boolean;
  truncate?: boolean;
}) {
  return (
    <button
      class="message-author btn-reset"
      classList={{
        truncate: props.truncate,
        disabled: props.disabled,
        [props.class ?? ""]: !!props.class,
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
