import type { JSX } from "solid-js";
import "./Overlay.css";

export interface OverlayProps {
  onClose: () => void;
  children: JSX.Element;
}

export default function Overlay(props: OverlayProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close is a mouse-only convenience; callers pair this with useEscapeClose for the keyboard equivalent
    // biome-ignore lint/a11y/useKeyWithClickEvents: see above
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      {props.children}
    </div>
  );
}
