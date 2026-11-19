import { createSignal, type JSX, onCleanup } from "solid-js";

const HOVER_SETTLE_MS = 120;

export function createRowEngagement() {
  const [engaged, setEngaged] = createSignal(false);
  const [keyboardFocus, setKeyboardFocus] = createSignal<"row" | "within">();
  let settle: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(settle));

  const events: JSX.HTMLAttributes<HTMLDivElement> = {
    onFocusIn: (e) => {
      setEngaged(true);
      setKeyboardFocus(
        e.target.matches(":focus-visible")
          ? e.target === e.currentTarget
            ? "row"
            : "within"
          : undefined,
      );
    },
    onFocusOut: (e) => {
      setKeyboardFocus(undefined);
      const next = e.relatedTarget;
      if (!(next instanceof Node && e.currentTarget.contains(next))) setEngaged(false);
    },
    onMouseEnter: () => {
      clearTimeout(settle);
      settle = setTimeout(() => setEngaged(true), HOVER_SETTLE_MS);
    },
    onMouseLeave: (e) => {
      clearTimeout(settle);
      if (!e.currentTarget.matches(":focus-within")) setEngaged(false);
    },
  };

  return { engaged, events, keyboardFocus };
}
