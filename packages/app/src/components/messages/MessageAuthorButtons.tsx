export function MessageAvatarButton(props: { color?: string; src?: string; onClick: () => void }) {
  return (
    <button
      class="message-avatar btn-reset flex-center"
      onClick={props.onClick}
      style={{ background: props.color ?? "#616061" }}
      type="button"
    >
      <img alt="?" class="message-avatar-img" src={props.src} />
    </button>
  );
}
export function MessageAuthorButton(props: {
  disabled: boolean;
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      class="message-author btn-reset"
      disabled={props.disabled}
      onClick={props.onClick}
      type="button"
    >
      {props.name}
    </button>
  );
}
