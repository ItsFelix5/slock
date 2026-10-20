import { createViewState, type ViewState } from "@slock/blockkit";
import { createSignal } from "solid-js";

type Errors = Record<string, string>;

export function createViewSession() {
  const states = new Map<string, ViewState>();
  const [errors, setErrors] = createSignal<Record<string, Errors>>({});

  const [touched, setTouched] = createSignal<string[]>([]);

  const clearError = (viewId: string, blockId: string) => {
    setTouched((ids) => (ids.includes(viewId) ? ids : [...ids, viewId]));
    setErrors((all) => {
      if (!all[viewId]?.[blockId]) return all;
      const rest = { ...all[viewId] };
      delete rest[blockId];
      return { ...all, [viewId]: rest };
    });
  };

  const stateFor = (viewId: string) => {
    const existing = states.get(viewId);
    if (existing) return existing;
    const created = createViewState((blockId) => clearError(viewId, blockId));
    states.set(viewId, created);
    return created;
  };

  const forget = (keep: string[]) => {
    for (const id of states.keys()) if (!keep.includes(id)) states.delete(id);
    setTouched((ids) => ids.filter((id) => keep.includes(id)));
    setErrors((all) => Object.fromEntries(Object.entries(all).filter(([id]) => keep.includes(id))));
  };

  return {
    errorsFor: (viewId: string): Errors => errors()[viewId] ?? {},
    forget,
    setErrorsFor: (viewId: string, next: Errors) =>
      setErrors((all) => ({ ...all, [viewId]: next })),
    stateFor,
    touched: (viewId: string) => touched().includes(viewId),
  };
}
