import { type JSX, onCleanup } from "solid-js";

export function SplitNavigation(props: { children: JSX.Element; onSplit: () => void }) {
  const onActivate = (event: MouseEvent | KeyboardEvent) => {
    if (!event.shiftKey || event.defaultPrevented) return;
    if (event instanceof KeyboardEvent && (event.key !== "Enter" || isTyping(event.target))) return;
    event.preventDefault();
    event.stopPropagation();
    props.onSplit();
  };

  return (
    <span
      ref={(el) => {
        el.addEventListener("click", onActivate, true);
        el.addEventListener("keydown", onActivate, true);
        onCleanup(() => {
          el.removeEventListener("click", onActivate, true);
          el.removeEventListener("keydown", onActivate, true);
        });
      }}
      style={{ display: "contents" }}
    >
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
