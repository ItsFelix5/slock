import Tooltip from "../overlay/Tooltip";
import "./Switch.css";

export interface SwitchProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  title: string;
}

export default function Switch(props: SwitchProps) {
  return (
    <Tooltip content={props.title}>
      <button
        aria-checked={props.checked}
        aria-label={props.title}
        class="switch"
        classList={{ disabled: props.disabled, on: props.checked }}
        disabled={props.disabled}
        onClick={() => props.onChange(!props.checked)}
        role="switch"
        type="button"
      >
        <span class="switch-knob" />
      </button>
    </Tooltip>
  );
}
