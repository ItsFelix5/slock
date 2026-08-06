import { Icon } from "@slock/ui";
import { createSignal, type JSX, Show } from "solid-js";
import "./MediaFrame.css";

export default function MediaFrame(props: { title: string; children: JSX.Element }) {
  const [collapsed, setCollapsed] = createSignal(false);
  return (
    <div class="media-frame">
      <button
        aria-expanded={!collapsed()}
        class="media-frame-toggle btn-reset flex-align-center"
        onClick={() => setCollapsed((c) => !c)}
        type="button"
      >
        <Icon name={collapsed() ? "caret-right-filled" : "caret-down-filled"} size={11} />
        <span class="media-frame-title">{props.title}</span>
      </button>
      <Show when={!collapsed()}>{props.children}</Show>
    </div>
  );
}
