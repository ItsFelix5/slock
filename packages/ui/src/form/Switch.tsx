import "./Switch.css";

export interface SwitchProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
}

export default function Switch(props: SwitchProps) {
  return (
    <button
      class="switch"
      classList={{ disabled: props.disabled, on: props.checked }}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      title={props.title}
      type="button"
    >
      <span class="switch-knob" />
    </button>
  );
}
