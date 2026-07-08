import type { JSX } from "solid-js";
import "./Overlay.css";

export interface OverlayProps {
  onClose: () => void;
  children: JSX.Element;
}

export default function Overlay(props: OverlayProps) {
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      {props.children}
    </div>
  );
}
