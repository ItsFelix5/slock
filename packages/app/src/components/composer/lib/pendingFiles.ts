import { createEffect, createSignal } from "solid-js";

const pendingFilesByDraft = new Map<string, File[]>();

export function createPendingFileState(opts: {
  disabled: () => boolean;
  draftKey: () => string | undefined;
}) {
  const [files, setFiles] = createSignal<File[]>([]);
  let loadedKey: string | undefined;

  createEffect(() => {
    const key = opts.draftKey();
    if (key === loadedKey) return;
    loadedKey = key;
    setFiles(key ? (pendingFilesByDraft.get(key) ?? []) : []);
  });

  const store = (next: File[]) => {
    setFiles(next);
    const key = opts.draftKey();
    if (!key) return;
    if (next.length > 0) pendingFilesByDraft.set(key, next);
    else pendingFilesByDraft.delete(key);
  };

  return {
    add(fileList: FileList | File[]) {
      if (opts.disabled()) return;
      store([...files(), ...Array.from(fileList)]);
    },
    clear(submittedKey: string) {
      pendingFilesByDraft.delete(submittedKey);
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
