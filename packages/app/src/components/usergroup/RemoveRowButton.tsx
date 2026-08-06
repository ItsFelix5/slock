import { Icon, Tooltip } from "@slock/ui";

export interface RemoveRowButtonProps {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}

export default function RemoveRowButton(props: RemoveRowButtonProps) {
  return (
    <Tooltip content={props.label}>
      <button
        aria-label={props.label}
        class="usergroup-details-row-remove btn-reset flex-center"
        disabled={props.disabled}
        onClick={props.onClick}
        type="button"
      >
        <Icon name="close-filled" size={14} />
      </button>
    </Tooltip>
  );
}
