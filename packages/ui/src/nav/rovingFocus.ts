import { type Accessor, createEffect } from "solid-js";
import { rovingTabIndex } from "../form/listNavigation";

export function initRovingTabIndexDefault(
  container: Accessor<HTMLElement | undefined>,
  dep: Accessor<unknown>,
) {
  createEffect(() => {
    dep();
    queueMicrotask(() => {
      const rows = [...(container()?.querySelectorAll<HTMLElement>("[data-nav-row]") ?? [])];
      if (rows.length && !rows.some((row) => row.tabIndex === 0)) rovingTabIndex(rows, 0);
    });
  });
}
