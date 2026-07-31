export interface CanvasSaveControllerOptions {
  dirty: () => boolean;
  fileId: () => string | undefined;
  onSaved: (snapshot: string) => void;
  persist: (fileId: string, snapshot: string) => Promise<boolean>;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  text: () => string;
}

export function createCanvasSaveController(options: CanvasSaveControllerOptions) {
  let savePromise: Promise<boolean> | undefined;

  const save = (): Promise<boolean> => {
    if (savePromise) return savePromise;
    const id = options.fileId();
    if (!id) return Promise.resolve(false);
    const snapshot = options.text();
    options.setSaving(true);
    savePromise = options
      .persist(id, snapshot)
      .then((saved) => {
        if (!saved) return false;
        options.onSaved(snapshot);
        if (options.text() === snapshot) options.setDirty(false);
        return true;
      })
      .finally(() => {
        options.setSaving(false);
        savePromise = undefined;
      });
    return savePromise;
  };

  const flush = async (): Promise<boolean> => {
    while (options.dirty()) {
      if (!(await save())) return false;
    }
    return true;
  };

  return { flush, save };
}
