import { defined } from "@slock/core";
import { uploadFilesForEdit } from "@slock/plugins/slack/client/api";
import type { SlackFile } from "@slock/types";
import { type Accessor, createSignal } from "solid-js";

type Upload = { progress: Accessor<number | undefined>; result: Promise<SlackFile> };

const uploads = new WeakMap<File, Upload>();

export function startUpload(file: File): Upload {
  const current = uploads.get(file);
  if (current && current.progress() !== undefined) return current;
  const [progress, setProgress] = createSignal<number | undefined>(0);
  const result = uploadFilesForEdit([{ file }], (_, fraction) => setProgress(fraction)).then(
    ([done]) => {
      setProgress(1);
      return defined(done);
    },
  );
  result.catch(() => setProgress(undefined));
  const upload = { progress, result };
  uploads.set(file, upload);
  return upload;
}

export function uploadProgress(file: File) {
  return uploads.get(file)?.progress();
}

export function uploadAll(files: File[]): Promise<SlackFile[]> {
  return Promise.all(files.map((file) => startUpload(file).result));
}
