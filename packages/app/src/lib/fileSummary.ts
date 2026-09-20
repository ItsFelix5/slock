import type { IconName } from "@slock/ui";
import type { SlackFile } from "./api";

export function fileIconName(file: SlackFile): IconName {
  if (file.isPdf) return "pdf-file";
  if (file.isVideo) return "video";
  if (file.isMail) return "email";
  if (file.isAudio) return "sound";
  if (file.isImage) return "image";
  return "file";
}

export function fileSummaryIcon(files: SlackFile[]): IconName {
  const icon = fileIconName(files[0]);
  return files.every((file) => fileIconName(file) === icon) ? icon : "files";
}

export function fileSummaryLabel(files: SlackFile[]): string {
  return files.length === 1 ? files[0].title || files[0].name : `${files.length} files`;
}
