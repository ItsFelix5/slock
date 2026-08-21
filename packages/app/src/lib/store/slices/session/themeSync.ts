import { createEffect, createSignal } from "solid-js";
import type { UserPrefs } from "../../../api";
import { actionFeedback } from "../../../feedback";
import { createSerialMutationQueue } from "../../mutations/serialMutationQueue";

const SYNC_DEBOUNCE_MS = 400;

export function createSyncedThemeValue<T>(deps: {
  apply: (value: T) => void;
  label: string;
  read: (prefs: UserPrefs) => T | undefined;
  signal: () => T;
  userPrefs: () => UserPrefs | undefined;
  write: (value: T) => Promise<unknown>;
}): void {
  const runMutation = createSerialMutationQueue();
  const [seeded, setSeeded] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    const prefs = deps.userPrefs();
    if (!prefs || seeded()) return;
    const stored = deps.read(prefs);
    if (stored !== undefined) deps.apply(stored);
    setSeeded(true);
  });

  createEffect(() => {
    const value = deps.signal();
    if (!seeded()) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      runMutation(() => deps.write(value)).catch((err) => {
        console.error(`Failed to sync ${deps.label}`, err);
        actionFeedback.flash(deps.label, `Failed to sync ${deps.label}.`, "error");
      });
    }, SYNC_DEBOUNCE_MS);
  });
}
