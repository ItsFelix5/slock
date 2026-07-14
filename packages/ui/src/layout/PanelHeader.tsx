import type { JSX } from "solid-js";
import "./PanelHeader.css";
import Icon from "../media/Icon";

export interface PanelHeaderProps {
  children?: JSX.Element;
  onClose: () => void;
  title?: string;
}

export default function PanelHeader(props: PanelHeaderProps) {
  return (
    <div class="panel-header">
      {props.children ?? (props.title && <h2 class="panel-header-title">{props.title}</h2>)}
      <button class="panel-close-btn" onClick={props.onClose} title="Close" type="button">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
