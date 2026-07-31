import { createEffect, createSignal } from "solid-js";

export function draftCacheKey(channelId: string, threadTs?: string): string {
  return threadTs ? `${channelId}:thread:${threadTs}` : channelId;
}

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
  };
}

export async function submitComposerPayload(opts: {
  blocks?: unknown;
  files: File[];
  isSlashAttempt: boolean;
  onSuccess: (clearFiles: boolean) => void;
  runCommand: () => Promise<{ handled: boolean; succeeded: boolean }>;
  sendMessage: (blocks?: unknown) => Promise<void>;
  uploadFiles: () => Promise<void>;
}): Promise<boolean> {
  if (opts.files.length > 0) {
    await opts.uploadFiles();
    opts.onSuccess(true);
    return true;
  }
  if (opts.blocks) {
    await opts.sendMessage(opts.blocks);
    opts.onSuccess(false);
    return true;
  }
  if (opts.isSlashAttempt) {
    const result = await opts.runCommand();
    if (result.handled) {
      if (result.succeeded) opts.onSuccess(false);
      return result.succeeded;
    }
  }
  await opts.sendMessage();
  opts.onSuccess(false);
  return true;
}
