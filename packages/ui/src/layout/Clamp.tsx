import type { JSX } from "@solidjs/web";
import { createContext, createSignal, onSettled, Show, useContext } from "solid-js";
import "./Clamp.css";

const InsideClamp = createContext(false);
const TOGGLE_CLASS = "clamp-toggle";
const GRACE_LINES = 6;

export function toggleClamps(root: Element) {
  const toggles = [...root.querySelectorAll<HTMLButtonElement>(`.${TOGGLE_CLASS}`)];
  const collapsed = toggles.filter((toggle) => toggle.ariaExpanded === "false");
  for (const toggle of collapsed.length ? collapsed : toggles) toggle.click();
}

export default function Clamp(props: { children: JSX.Element; class?: string; lines?: number }) {
  const nested = useContext(InsideClamp);
  const lines = () => (nested ? undefined : props.lines);
  const [expanded, setExpanded] = createSignal(false);
  const [overflowing, setOverflowing] = createSignal(false);
  const clamped = () => lines() !== undefined && !expanded();
  const shownLines = () => {
    const limit = lines();
    return limit === undefined || overflowing() ? limit : limit + GRACE_LINES;
  };
  let box: HTMLDivElement | undefined;
  let content: HTMLDivElement | undefined;

  onSettled(() => {
    if (nested || !(box && content)) return;
    const outer = box;
    const inner = content;
    const observer = new ResizeObserver(() => {
      const limit = lines();
      const shown = shownLines();
      if (limit === undefined || shown === undefined || expanded()) return;
      const lineHeight = Number.parseFloat(getComputedStyle(outer).maxHeight) / shown;
      setOverflowing(inner.offsetHeight > lineHeight * (limit + GRACE_LINES) + 2);
    });
    observer.observe(inner);
    return () => observer.disconnect();
  });

  return (
    <div>
      <div
        class={[props.class, { clamp: clamped(), "clamp--faded": clamped() && overflowing() }]}
        onScroll={() => setExpanded(true)}
        ref={box}
        style={{ "--clamp-lines": shownLines() }}
      >
        <div ref={content}>
          <InsideClamp value={true}>{props.children}</InsideClamp>
        </div>
      </div>
      <Show when={lines() !== undefined && overflowing()}>
        <button
          aria-expanded={expanded() ? "true" : "false"}
          class={TOGGLE_CLASS}
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          {expanded() ? "Show less" : "Show more"}
        </button>
      </Show>
    </div>
  );
}
