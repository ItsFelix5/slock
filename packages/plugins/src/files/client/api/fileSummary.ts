import { defined } from "@slock/core";
import type { SlackFile } from "@slock/types";
import type { IconName } from "@slock/ui";

export function isCanvasFile(file: SlackFile) {
  return file.filetype === "quip";
}

export function fileKindLabel(file: SlackFile): string | undefined {
  return isCanvasFile(file) ? "Canvas" : file.filetype?.toUpperCase();
}

export function fileIconName(file: SlackFile): IconName {
  if (isCanvasFile(file)) return "canvas";
  if (file.isPdf) return "pdf-file";
  if (file.isVideo) return "video";
  if (file.isMail) return "email";
  if (file.isAudio) return "sound";
  if (file.isImage) return "image";
  return "file";
}

export function fileSummaryIcon(files: SlackFile[]): IconName {
  const icon = fileIconName(defined(files[0]));
  return files.every((file) => fileIconName(file) === icon) ? icon : "files";
}

export function fileSummaryLabel(files: SlackFile[]): string {
  return files.length === 1
    ? defined(files[0]).title || defined(files[0]).name
    : `${files.length} files`;
}
