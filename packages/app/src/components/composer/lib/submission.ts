export async function submitComposerPayload(opts: {
  blocks?: unknown;
  files: File[];
  isSlashAttempt: boolean;
  onError: (err: unknown) => void;
  onSuccess: (clearFiles: boolean) => void;
  runCommand: () => Promise<{ handled: boolean; succeeded: boolean }>;
  sendMessage: (blocks?: unknown) => Promise<void>;
  uploadFiles: () => Promise<void>;
}): Promise<boolean> {
  if (opts.files.length > 0) {
    opts.onSuccess(true);
    opts.uploadFiles().catch(opts.onError);
    return true;
  }
  if (opts.blocks) {
    opts.onSuccess(false);
    opts.sendMessage(opts.blocks).catch(opts.onError);
    return true;
  }
  if (opts.isSlashAttempt) {
    const result = await opts.runCommand();
    if (result.handled) {
      if (result.succeeded) opts.onSuccess(false);
      return result.succeeded;
    }
  }
  opts.onSuccess(false);
  opts.sendMessage().catch(opts.onError);
  return true;
}
