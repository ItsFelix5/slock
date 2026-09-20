import { IconButton } from "@slock/ui";

export interface RemoveRowButtonProps {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}

export default function RemoveRowButton(props: RemoveRowButtonProps) {
  return (
    <IconButton
      class="usergroup-details-row-remove"
      disabled={props.disabled}
      icon="close-filled"
      iconSize={14}
      label={props.label}
      onClick={props.onClick}
    />
  );
}
