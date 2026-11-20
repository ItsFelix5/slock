import type { SlackFile, SlackLink } from "@slock/types";

export type FilesLinksEntry =
  | { kind: "file"; sortTs: number; file: SlackFile }
  | { kind: "link"; sortTs: number; link: SlackLink };

export function mergeEntries(files: SlackFile[], links: SlackLink[]): FilesLinksEntry[] {
  return [
    ...files.map((file): FilesLinksEntry => ({ file, kind: "file", sortTs: file.created ?? 0 })),
    ...links.map((link): FilesLinksEntry => ({ kind: "link", link, sortTs: parseFloat(link.ts) })),
  ].sort((a, b) => b.sortTs - a.sortTs);
}

export function appendEntries(
  entries: FilesLinksEntry[],
  files: SlackFile[],
  links: SlackLink[],
): FilesLinksEntry[] {
  const filesById = new Map<string, SlackFile>();
  const linksById = new Map<string, SlackLink>();
  for (const entry of entries) {
    if (entry.kind === "file") filesById.set(entry.file.id, entry.file);
    else linksById.set(`${entry.link.ts}:${entry.link.url}`, entry.link);
  }
  for (const file of files) filesById.set(file.id, file);
  for (const link of links) linksById.set(`${link.ts}:${link.url}`, link);
  return mergeEntries([...filesById.values()], [...linksById.values()]);
}
