import type { JSX } from "solid-js";
import { Show } from "solid-js";
import Icon from "../media/Icon";
import { useEscapeClose } from "../useEscapeClose";
import Overlay from "./Overlay";
import "./Modal.css";
import Tooltip from "./Tooltip";

export interface ModalProps {
  align?: "center" | "top";
  ariaLabel: string;
  children: JSX.Element;
  class?: string;
  onClose: () => void;
}

export default function Modal(props: ModalProps) {
  useEscapeClose(props.onClose);
  return (
    <Overlay ariaLabel={props.ariaLabel} align={props.align} onClose={props.onClose}>
      <div class={props.class ? `modal-card ${props.class}` : "modal-card"}>{props.children}</div>
    </Overlay>
  );
}

export interface ModalCloseButtonProps {
  class?: string;
  label?: string;
  onClose: () => void;
}

export function ModalCloseButton(props: ModalCloseButtonProps) {
  const label = () => props.label ?? "Close";
  return (
    <Tooltip content={label()}>
      <button
        aria-label={label()}
        class={props.class ? `panel-close-btn ${props.class}` : "panel-close-btn"}
        onClick={props.onClose}
        type="button"
      >
        <Icon name="close" size={12} />
      </button>
    </Tooltip>
  );
}

export interface ModalHeaderProps {
  children?: JSX.Element;
  onClose: () => void;
  title?: JSX.Element;
}

export function ModalHeader(props: ModalHeaderProps) {
  return (
    <div class="modal-header flex-between">
      <div class="modal-header-title flex-between">
        {props.children}
        <Show when={props.title}>
          <h2>{props.title}</h2>
        </Show>
      </div>
      <ModalCloseButton onClose={props.onClose} />
    </div>
  );
}
