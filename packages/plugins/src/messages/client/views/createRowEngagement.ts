import type { TimerHandle } from "@slock/core";
import { service } from "@slock/core/solid";
import type { JSX } from "@solidjs/web";
import { createSignal, onCleanup } from "solid-js";

const env = service("env");

const HOVER_SETTLE_MS = 120;

export function createRowEngagement() {
  const [engaged, setEngaged] = createSignal(false);
  const [keyboardFocus, setKeyboardFocus] = createSignal<"row" | "within">();
  let settle: TimerHandle | undefined;
  onCleanup(() => settle?.cancel());

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
      settle?.cancel();
      settle = env.setTimeout(() => setEngaged(true), HOVER_SETTLE_MS);
    },
    onMouseLeave: (e) => {
      settle?.cancel();
      if (!e.currentTarget.matches(":focus-within")) setEngaged(false);
    },
  };

  return { engaged, events, keyboardFocus };
}
