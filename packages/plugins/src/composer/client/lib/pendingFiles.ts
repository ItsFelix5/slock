import { createSignal } from "solid-js";
import { startUpload } from "./attachUpload";

export function createPendingFilesStore() {
  const byDraft = new Map<string, File[]>();
  return {
    delete: (key: string) => byDraft.delete(key),
    get: (key: string) => byDraft.get(key) ?? [],
    set: (key: string, files: File[]) => byDraft.set(key, files),
  };
}

export function createPendingFileState(opts: {
  disabled: () => boolean;
  draftKey: () => string | undefined;
  store: ReturnType<typeof createPendingFilesStore>;
  uploadOnAttach: () => boolean;
}) {
  const [files, setFiles] = createSignal<File[]>(() => {
    const key = opts.draftKey();
    return key ? opts.store.get(key) : [];
  });

  const store = (next: File[]) => {
    if (opts.uploadOnAttach()) for (const file of next) startUpload(file);
    setFiles(next);
    const key = opts.draftKey();
    if (!key) return;
    if (next.length > 0) opts.store.set(key, next);
    else opts.store.delete(key);
  };

  return {
    add(fileList: FileList | File[]) {
      if (opts.disabled()) return;
      store([...files(), ...Array.from(fileList)]);
    },
    replace(file: File, next: File) {
      if (opts.disabled()) return;
      store(files().map((current) => (current === file ? next : current)));
    },
    clear(submittedKey: string) {
      opts.store.delete(submittedKey);
      if (opts.draftKey() === submittedKey) setFiles([]);
    },
    files,
    remove(index: number) {
      if (opts.disabled()) return;
      store(files().filter((_, currentIndex) => currentIndex !== index));
    },
    rename(index: number, name: string) {
      if (opts.disabled()) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      store(
        files().map((file, currentIndex) =>
          currentIndex === index && trimmed !== file.name
            ? new File([file], trimmed, { lastModified: file.lastModified, type: file.type })
            : file,
        ),
      );
    },
  };
}
