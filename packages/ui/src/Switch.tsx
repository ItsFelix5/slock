import "./Switch.css";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
}

export default function Switch(props: SwitchProps) {
  return (
    <button
      type="button"
      class="switch"
      classList={{ on: props.checked }}
      onClick={() => props.onChange(!props.checked)}
      title={props.title}
    >
      <span class="switch-knob" />
    </button>
  );
}
