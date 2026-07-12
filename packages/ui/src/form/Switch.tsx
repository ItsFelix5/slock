import "./Switch.css";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
  disabled?: boolean;
}

export default function Switch(props: SwitchProps) {
  return (
    <button
      type="button"
      class="switch"
      classList={{ on: props.checked, disabled: props.disabled }}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      title={props.title}
    >
      <span class="switch-knob" />
    </button>
  );
}
