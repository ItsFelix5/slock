import { service } from "@slock/core/solid";
import { onSettled } from "solid-js";
import type { ShortcutDef } from "./shortcutRegistry";

const ui = service("ui");

export function inside(...roots: (() => Element | null | undefined)[]) {
  return (element: Element) => roots.some((root) => root()?.contains(element));
}

export const dispatchShortcut = (event: KeyboardEvent) => ui.shortcuts.dispatch(event);

export function useShortcut(def: ShortcutDef) {
  onSettled(() => ui.shortcuts.register(def));
}
