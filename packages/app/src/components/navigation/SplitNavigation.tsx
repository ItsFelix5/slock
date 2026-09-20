import { type JSX, onCleanup } from "solid-js";

export function SplitNavigation(props: { children: JSX.Element; onSplit: () => void }) {
  const onClick = (event: MouseEvent) => {
    if (!event.shiftKey || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    props.onSplit();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || !event.shiftKey || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    props.onSplit();
  };

  return (
    <span
      ref={(el) => {
        el.addEventListener("click", onClick, true);
        el.addEventListener("keydown", onKeyDown, true);
        onCleanup(() => {
          el.removeEventListener("click", onClick, true);
          el.removeEventListener("keydown", onKeyDown, true);
        });
      }}
      style={{ display: "contents" }}
    >
      {props.children}
    </span>
  );
}
