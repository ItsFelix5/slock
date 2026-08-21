import { type JSX, Show } from "solid-js";
import "./PanelHeader.css";
import Icon from "../media/Icon";
import Tooltip from "../overlay/Tooltip";

export interface PanelHeaderProps {
  bottom?: JSX.Element;
  canClose?: boolean;
  children?: JSX.Element;
  onClose: () => void;
  title?: string;
}

export default function PanelHeader(props: PanelHeaderProps) {
  return (
    <div class="panel-header-wrap">
      <div class="panel-header">
        {props.children ?? (props.title && <h2 class="panel-header-title">{props.title}</h2>)}
        <Show when={props.canClose ?? true}>
          <Tooltip content="Close">
            <button
              aria-label="Close"
              class="panel-close-btn"
              onClick={props.onClose}
              type="button"
            >
              <Icon name="close" size={16} />
            </button>
          </Tooltip>
        </Show>
      </div>
      {props.bottom}
    </div>
  );
}
