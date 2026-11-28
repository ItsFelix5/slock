import type { JSX } from "@solidjs/web";
import { createSignal, Show } from "solid-js";
import { ariaBoolean } from "../ariaBoolean";
import Icon from "./Icon";
import "./MediaFrame.css";

interface MediaFrameProps {
  children: JSX.Element;
  title: string;
  titleUrl?: string;
}

export default function MediaFrame(props: MediaFrameProps) {
  const [collapsed, setCollapsed] = createSignal(false);
  const toggle = () => {
    setCollapsed((value) => !value);
  };
  const caret = () => (
    <Icon name={collapsed() ? "caret-right-filled" : "caret-down-filled"} size={11} />
  );
  return (
    <div class="media-frame">
      <Show
        fallback={
          <button
            aria-expanded={ariaBoolean(!collapsed())}
            class="media-frame-toggle btn-reset flex-align-center"
            onClick={toggle}
            type="button"
          >
            <span class="media-frame-caret">{caret()}</span>
            <span class="media-frame-title truncate">{props.title}</span>
          </button>
        }
        when={props.titleUrl}
      >
        {(titleUrl) => (
          <div class="media-frame-toggle flex-align-center">
            <button
              aria-expanded={ariaBoolean(!collapsed())}
              aria-label={collapsed() ? "Expand" : "Collapse"}
              class="media-frame-caret btn-reset"
              onClick={toggle}
              type="button"
            >
              {caret()}
            </button>
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
