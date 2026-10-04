import { createSignal, type JSX, Show } from "solid-js";
import Icon from "./Icon";
import "./MediaFrame.css";

export interface MediaFrameProps {
  children: JSX.Element;
  title: string;
  titleUrl?: string;
}

export default function MediaFrame(props: MediaFrameProps) {
  const [collapsed, setCollapsed] = createSignal(false);
  const caret = () => (
    <button
      aria-expanded={!collapsed()}
      aria-label={collapsed() ? "Expand" : "Collapse"}
      class="media-frame-caret btn-reset"
      onClick={() => setCollapsed((collapsed) => !collapsed)}
      type="button"
    >
      <Icon name={collapsed() ? "caret-right-filled" : "caret-down-filled"} size={11} />
    </button>
  );
  return (
    <div class="media-frame">
      <Show
        fallback={
          <button
            aria-expanded={!collapsed()}
            class="media-frame-toggle btn-reset flex-align-center"
            onClick={() => setCollapsed((collapsed) => !collapsed)}
            type="button"
          >
            {caret()}
            <span class="media-frame-title truncate">{props.title}</span>
          </button>
        }
        when={props.titleUrl}
      >
        {(titleUrl) => (
          <div class="media-frame-toggle flex-align-center">
            {caret()}
            <a
              class="media-frame-title truncate"
              data-link-url={titleUrl()}
              href={titleUrl()}
              rel="noopener noreferrer"
              target="_blank"
            >
              {props.title}
            </a>
          </div>
        )}
      </Show>
      <Show when={!collapsed()}>{props.children}</Show>
    </div>
  );
}
