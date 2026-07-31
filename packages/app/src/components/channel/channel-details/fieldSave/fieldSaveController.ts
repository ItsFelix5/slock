export async function saveEditableField<T>(options: {
  next: T;
  persist: (next: T) => Promise<boolean>;
  previous: T;
  refresh: () => Promise<unknown>;
  restore: (previous: T) => void;
  setPending: (pending: boolean) => void;
}): Promise<boolean> {
  options.setPending(true);
  try {
    if (!(await options.persist(options.next))) {
      options.restore(options.previous);
      return false;
    }
    try {
      await options.refresh();
    } catch {
      // The edit is server-confirmed even if its follow-up resource refresh
      // fails; the resource owns its retry/error state.
    }
    return true;
  } finally {
    options.setPending(false);
  }
}
