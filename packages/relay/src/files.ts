const KEEP_MS = 60_000;
const MAX_BYTES = 256 * 1024 * 1024;

const uploads = new Map<string, File[]>();
let held = 0;

export function stashFile(uploadId: string, file: File) {
  if (held + file.size > MAX_BYTES) return false;
  if (!uploads.has(uploadId)) setTimeout(() => takeFiles(uploadId), KEEP_MS).unref();
  uploads.set(uploadId, [...(uploads.get(uploadId) ?? []), file]);
  held += file.size;
  return true;
}

export function takeFiles(uploadId: string) {
  const files = uploads.get(uploadId);
  uploads.delete(uploadId);
  held -= files?.reduce((sum, file) => sum + file.size, 0) ?? 0;
  return files;
}
