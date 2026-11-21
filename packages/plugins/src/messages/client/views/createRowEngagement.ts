import type { JSX } from "@solidjs/web";
import { createSignal } from "solid-js";

export function createRowEngagement() {
  const [engaged, setEngaged] = createSignal(false);
  const [keyboardFocus, setKeyboardFocus] = createSignal<"row" | "within">();

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
    onMouseEnter: () => setEngaged(true),
    onMouseLeave: (e) => {
      if (!e.currentTarget.querySelector(":focus-visible")) setEngaged(false);
    },
  };

  return { engaged, events, keyboardFocus };
}
