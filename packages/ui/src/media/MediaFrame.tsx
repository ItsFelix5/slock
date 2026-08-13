import { createSignal, type JSX, Show } from "solid-js";
import Icon from "./Icon";
import "./MediaFrame.css";

export interface MediaFrameProps {
  children: JSX.Element;
  title: string;
}

export default function MediaFrame(props: MediaFrameProps) {
  const [collapsed, setCollapsed] = createSignal(false);
  return (
    <div class="media-frame">
      <button
        aria-expanded={!collapsed()}
        class="media-frame-toggle btn-reset flex-align-center"
        onClick={() => setCollapsed((collapsed) => !collapsed)}
        type="button"
      >
        <Icon name={collapsed() ? "caret-right-filled" : "caret-down-filled"} size={11} />
        <span class="media-frame-title">{props.title}</span>
      </button>
      <Show when={!collapsed()}>{props.children}</Show>
    </div>
  );
}
