import type { SlackFile, SlackLink } from "@slock/types";

export type FilesLinksEntry =
  | { kind: "file"; sortTs: number; file: SlackFile }
  | { kind: "link"; sortTs: number; link: SlackLink };

export function entryKey(entry: FilesLinksEntry): string {
  return entry.kind === "file"
    ? `file:${entry.file.id}`
    : `link:${entry.link.ts}:${entry.link.url}`;
}

export const newestFirst = (a: FilesLinksEntry, b: FilesLinksEntry) => b.sortTs - a.sortTs;

export function toEntries(files: SlackFile[], links: SlackLink[]): FilesLinksEntry[] {
  return [
    ...files.map((file): FilesLinksEntry => ({ file, kind: "file", sortTs: file.created ?? 0 })),
    ...links.map((link): FilesLinksEntry => ({ kind: "link", link, sortTs: parseFloat(link.ts) })),
  ];
}
