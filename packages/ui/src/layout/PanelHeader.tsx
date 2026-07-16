import type { JSX } from "solid-js";
import "./PanelHeader.css";
import Icon from "../media/Icon";
import Tooltip from "../overlay/Tooltip";

export interface PanelHeaderProps {
  children?: JSX.Element;
  onClose: () => void;
  title?: string;
}

export default function PanelHeader(props: PanelHeaderProps) {
  return (
    <div class="panel-header">
      {props.children ?? (props.title && <h2 class="panel-header-title">{props.title}</h2>)}
      <Tooltip content="Close">
        <button aria-label="Close" class="panel-close-btn" onClick={props.onClose} type="button">
          <Icon name="close" size={16} />
        </button>
      </Tooltip>
    </div>
  );
}
