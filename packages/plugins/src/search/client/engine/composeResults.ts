import { isCanvasFile } from "@slock/plugins/files/client/api/fileSummary";
import type { SlackFile } from "@slock/types";
import type { Scope, SearchRequest } from "../searchQuery";
import { jumpRows, recentRows } from "./localRows";
import { fileRow, messageRow, type SearchRow } from "./rows";
import type { SearchSources, Source } from "./sources";

const JUMP_LIMIT = 8;
const TITLE_LIMIT = 5;
const LIST_LIMIT = 50;

interface Composition {
  paged?: SearchSources["files"] | SearchSources["messages"];
  rows: () => SearchRow[];
  sources: Source[];
}

function ofKind(scope: Scope, files: SlackFile[]): SlackFile[] {
  if (scope === "canvases") return files.filter(isCanvasFile);
  if (scope === "lists") return files.filter((file) => file.filetype === "list");
  return files;
}

function composeAll(request: SearchRequest, sources: SearchSources): Composition {
  const { channels, titles, users } = sources;
  const { jumpOnly, query, term } = request;
  if (!query) return { rows: recentRows, sources: [] };
  const jumps = () => jumpRows(term, channels.data() ?? [], users.data() ?? []);
  if (jumpOnly) return { rows: () => jumps().slice(0, LIST_LIMIT), sources: [users, channels] };
  return {
    rows: () => [
      { id: "messages", kind: "messages", query },
      ...jumps().slice(0, JUMP_LIMIT),
      ...(titles.data() ?? []).slice(0, TITLE_LIMIT).map(fileRow),
    ],
    sources: [users, channels, titles],
  };
}

function composeFiles({ query, scope }: SearchRequest, sources: SearchSources): Composition {
  const { files, recentFiles, titles } = sources;
  if (scope === "files" && !query) {
    return { rows: () => (recentFiles.data() ?? []).map(fileRow), sources: [recentFiles] };
  }
  return {
    paged: files,
    rows() {
      const found = [...ofKind(scope, titles.data() ?? []), ...(files.data()?.items ?? [])];
      return [...new Map(found.map((file) => [file.id, file])).values()].map(fileRow);
    },
    sources: [titles, files],
  };
}

export function composeResults(request: SearchRequest, sources: SearchSources): Composition {
  const { channels, history, messages, usergroups, users } = sources;
  const { query, term } = request;
  switch (request.scope) {
    case "all":
      return composeAll(request, sources);
    case "messages":
      if (!query) {
        const rows = () =>
          (history.data() ?? []).map(
            (entry): SearchRow => ({ entry, id: entry.hash, kind: "history" }),
          );
        return { rows, sources: [history] };
      }
      return {
        paged: messages,
        rows: () => (messages.data()?.items ?? []).map(messageRow),
        sources: [messages],
      };
    case "people":
      return {
        rows: () =>
          term
            ? [
                ...jumpRows(term, [], users.data() ?? []).filter((row) => row.kind !== "channel"),
                ...(usergroups.data() ?? []).map(
                  (group): SearchRow => ({ group, id: group.id, kind: "usergroup" }),
                ),
              ]
            : recentRows().filter((row) => row.kind !== "channel"),
        sources: [users, usergroups],
      };
    case "channels":
      return {
        rows: () =>
          term
            ? jumpRows(term, channels.data() ?? [], [])
                .filter((row) => row.kind === "channel")
                .slice(0, LIST_LIMIT)
            : recentRows().filter((row) => row.kind === "channel"),
        sources: [channels],
      };
    default:
      return composeFiles(request, sources);
  }
}
