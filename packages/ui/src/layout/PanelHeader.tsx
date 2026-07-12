import type { JSX } from "solid-js";
import "./PanelHeader.css";

export interface PanelHeaderProps {
  title?: string;
  onClose: () => void;
  children?: JSX.Element;
}

export default function PanelHeader(props: PanelHeaderProps) {
  return (
    <div class="panel-header">
      {props.children || (props.title && <h2 class="panel-header-title">{props.title}</h2>)}
      <button type="button" class="panel-close-btn" onClick={props.onClose} title="Close">
        ✕
      </button>
    </div>
  );
}
