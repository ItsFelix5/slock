import "./Switch.css";

export interface SwitchProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export default function Switch(props: SwitchProps) {
  return (
    <input
      checked={props.checked}
      class="switch"
      disabled={props.disabled}
      onChange={(e) => {
        props.onChange(e.currentTarget.checked);
        e.currentTarget.checked = props.checked;
      }}
      type="checkbox"
    />
  );
}
