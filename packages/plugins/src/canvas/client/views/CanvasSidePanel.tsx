import { inside, useCancelShortcut, useEscapeClose } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { onSettled } from "solid-js";
import "./CanvasSidePanel.css";

function holdFocus(panel: HTMLElement) {
  const rows = () => [...panel.querySelectorAll<HTMLElement>("[data-nav-row]:not([disabled])")];
  let held = panel;
  let index = 0;
  function remember({ target }: FocusEvent) {
    if (!(target instanceof HTMLElement)) return;
    held = target;
    index = Math.max(rows().indexOf(target), 0);
  }
  panel.addEventListener("focusin", remember);
  (panel.querySelector<HTMLElement>("[aria-pressed='true']") ?? rows()[0] ?? panel).focus();
  const changes = new MutationObserver(() => {
    const stranded =
      held === panel
        ? document.activeElement === panel
        : !held.isConnected && document.activeElement === document.body;
    if (!stranded) return;
    const next = rows();
    (next[Math.min(index, next.length - 1)] ?? panel).focus();
  });
  changes.observe(panel, { childList: true, subtree: true });
  return () => {
    changes.disconnect();
    panel.removeEventListener("focusin", remember);
  };
}

export default function CanvasSidePanel(props: {
  anchor: () => HTMLElement | undefined;
  children: JSX.Element;
  label: string;
  onClose: () => void;
  title: string;
}) {
  let panel: HTMLElement | undefined;

  useEscapeClose(props.onClose);
  useCancelShortcut(
    () => {
      props.onClose();
      queueMicrotask(() => props.anchor()?.focus());
    },
    { target: inside(() => panel) },
  );
  onSettled(() => panel && holdFocus(panel));

  return (
    <div class="canvas-side-slot">
      <aside
        aria-label={props.label}
        class="canvas-side-panel"
        ref={(element) => {
          panel = element;
        }}
        tabindex={-1}
      >
        <header class="canvas-side-header">
          <strong>{props.title}</strong>
        </header>
        {props.children}
      </aside>
    </div>
  );
}
