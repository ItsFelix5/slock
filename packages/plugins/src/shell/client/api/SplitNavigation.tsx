import { onSettled } from "solid-js";
import type { JSX } from "@solidjs/web";

export function SplitNavigation(props: { children: JSX.Element; onSplit: () => void }) {
  const onActivate = (event: MouseEvent | KeyboardEvent) => {
    if (!event.shiftKey || event.defaultPrevented) return;
    if (event instanceof KeyboardEvent && (event.key !== "Enter" || isTyping(event.target))) return;
    event.preventDefault();
    event.stopPropagation();
    props.onSplit();
  };

  let host: HTMLSpanElement | undefined;
  onSettled(() => {
    const el = host;
    if (!el) return;
    el.addEventListener("click", onActivate, true);
    el.addEventListener("keydown", onActivate, true);
    return () => {
      el.removeEventListener("click", onActivate, true);
      el.removeEventListener("keydown", onActivate, true);
    };
  });

  return (
    <span ref={host} style={{ display: "contents" }}>
      {props.children}
    </span>
  );
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
