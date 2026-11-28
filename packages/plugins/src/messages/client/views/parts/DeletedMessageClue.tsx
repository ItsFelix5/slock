import { Icon } from "@slock/ui";

export default function DeletedMessageClue(props: { onReveal: () => void }) {
  return (
    <button
      class="btn-reset message-deleted-clue"
      onClick={(e) => {
        e.currentTarget.closest<HTMLElement>(".message-row")?.focus();
        props.onReveal();
      }}
      type="button"
    >
      <Icon name="eye-closed" size={11} />
    </button>
  );
}
