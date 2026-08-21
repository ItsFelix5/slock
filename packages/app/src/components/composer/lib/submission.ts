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
