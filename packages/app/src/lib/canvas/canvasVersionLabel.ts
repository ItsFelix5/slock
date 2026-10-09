import type { CanvasVersion } from "@slock/types";
import { store } from "../store";

const VERSION_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function versionTime(version: CanvasVersion): string {
  return VERSION_FORMAT.format(new Date(version.createdMs));
}

export function versionAuthor(version: CanvasVersion): string {
  return store.users.userById(version.authorId)?.name ?? version.authorId;
}
