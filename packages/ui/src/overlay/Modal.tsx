import type { JSX } from "solid-js";
import { Show } from "solid-js";
import IconButton from "../button/IconButton";
import { useEscapeClose } from "../useEscapeClose";
import "./Modal.css";
import Overlay from "./Overlay";

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
    <IconButton
      class={props.class ? `panel-close-btn ${props.class}` : "panel-close-btn"}
      onClick={props.onClose}
      label={label()}
      icon="close"
      iconSize={12}
    />
  );
}

export interface ModalHeaderProps {
  children?: JSX.Element;
  onClose: () => void;
  title?: JSX.Element;
  buttons?: JSX.Element;
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
      <div class="modal-header-actions flex-align-center">
        {props.buttons}
        <ModalCloseButton onClose={props.onClose} />
      </div>
    </div>
  );
}
