import Icon, { type IconName } from "../media/Icon";
import "./AddRowButton.css";

export interface AddRowButtonProps {
  disabled?: boolean;
  icon: IconName;
  label: string;
  onClick: () => void;
}

export default function AddRowButton(props: AddRowButtonProps) {
  return (
    <button
      class="add-row-btn btn-reset flex-align-center"
      disabled={props.disabled}
      onClick={props.onClick}
      type="button"
    >
      <Icon name={props.icon} size={15} />
      {props.label}
    </button>
  );
}
