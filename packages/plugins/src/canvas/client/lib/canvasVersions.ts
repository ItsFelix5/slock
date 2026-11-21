import { startOfDay } from "@slock/core";
import { service } from "@slock/core/solid";
import type { CanvasVersion } from "@slock/types";

const usersStore = service("users");

const VERSION_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
const CLOCK_FORMAT = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  weekday: "short",
});

export interface VersionDay {
  label: string;
  versions: CanvasVersion[];
}

export function versionTime(version: CanvasVersion): string {
  return VERSION_FORMAT.format(new Date(version.createdMs));
}

export function versionClock(version: CanvasVersion): string {
  return CLOCK_FORMAT.format(new Date(version.createdMs));
}

export function versionAuthor(version: CanvasVersion): string {
  return usersStore.userById(version.authorId)?.name ?? version.authorId;
}

export function versionAuthorUser(version: CanvasVersion) {
  return usersStore.userById(version.authorId);
}

function dayLabel(ms: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return DAY_FORMAT.format(new Date(ms));
}

export function groupVersionsByDay(versions: CanvasVersion[], now: number): VersionDay[] {
  const days: VersionDay[] = [];
  for (const version of versions) {
    const label = dayLabel(version.createdMs, now);
    const last = days.at(-1);
    if (last?.label === label) last.versions.push(version);
    else days.push({ label, versions: [version] });
  }
  return days;
}

export function olderVersion(
  versions: CanvasVersion[],
  version: CanvasVersion,
): CanvasVersion | undefined {
  const index = versions.findIndex((candidate) => candidate.versionId === version.versionId);
  return index < 0 ? undefined : versions[index + 1];
}
