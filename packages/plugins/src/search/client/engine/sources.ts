import { maybeService } from "@slock/core/solid";
import type { PagedQuery, Query } from "@slock/plugins/query/client/api";
import { channelMatches } from "@slock/plugins/slack/client/api";
import { userMatches } from "@slock/plugins/users/client/api";
import { isWaiting } from "@slock/resource";
import { type Accessor, createMemo } from "solid-js";
import { parseTokens, type SearchRequest, withoutModifier } from "../searchQuery";
import {
  filePages,
  fileTitles,
  messagePages,
  recentFiles,
  searchHistory,
  usergroupMatches,
} from "./queries";

const MIN_TITLE_TERM = 2;

const usergroupDetails = maybeService("usergroup-details");

export interface Source {
  failed(): boolean;
  pending(): boolean;
  retry(): void;
}

type Select<Arg> = (request: SearchRequest) => Arg | undefined;

function createSource<Arg, Data>(
  query: Query<Arg, Data>,
  request: Accessor<SearchRequest>,
  select: Select<Arg>,
) {
  const arg = createMemo(() => select(request()));
  const state = query.state(arg);
  const current = () => (arg() === undefined ? undefined : state());
  return {
    arg,
    data: () => current()?.data,
    failed: () => current()?.status === "error" && !current()?.refreshing,
    pending() {
      const entry = current();
      return !!entry && (isWaiting(entry) || entry.refreshing);
    },
    retry() {
      const wanted = arg();
      if (wanted !== undefined) void query.refresh(wanted).catch(() => {});
    },
  };
}

function createPagedSource<Arg, Item>(
  query: PagedQuery<Arg, Item, number>,
  request: Accessor<SearchRequest>,
  select: Select<Arg>,
) {
  const source = createSource(query, request, select);
  const withArg = <Result>(read: (arg: Arg) => Result) => {
    const arg = source.arg();
    return arg === undefined ? undefined : read(arg);
  };
  return {
    ...source,
    loadingMore: () => !!withArg(query.loadingMore),
    more: () => void withArg(query.more),
    moreFailed: () => !!withArg(query.moreFailed),
  };
}

function titleTerm({ jumpOnly, query, scope, sort, term }: SearchRequest): string | undefined {
  const titled = scope === "all" ? !jumpOnly : ["files", "canvases", "lists"].includes(scope);
  if (!titled || sort !== "relevant" || parseTokens(query).length > 0) return;
  return term.length >= MIN_TITLE_TERM ? term : undefined;
}

function fileArg({ query, scope, sort }: SearchRequest) {
  if (scope === "files") return query ? { query, sort } : undefined;
  if (scope !== "canvases" && scope !== "lists") return;
  const rest = withoutModifier(query, "type");
  return {
    query: [`type:${scope}`, rest].filter(Boolean).join(" "),
    sort: query ? sort : ("newest" as const),
  };
}

export function messageArg({ excludeBots, myChannels, query, sort }: SearchRequest) {
  return { excludeBots, myChannels, query, sort };
}

export function createSearchSources(request: Accessor<SearchRequest>) {
  const termFor =
    (...scopes: SearchRequest["scope"][]) =>
    ({ scope, term }: SearchRequest) =>
      scopes.includes(scope) && term ? term : undefined;
  const whenEmpty =
    (wanted: SearchRequest["scope"]) =>
    ({ query, scope }: SearchRequest) =>
      scope === wanted && !query ? ("recent" as const) : undefined;

  return {
    channels: createSource(channelMatches, request, termFor("all", "channels")),
    files: createPagedSource(filePages, request, fileArg),
    history: createSource(searchHistory, request, whenEmpty("messages")),
    messages: createPagedSource(messagePages, request, (next) =>
      next.scope === "messages" && next.query ? messageArg(next) : undefined,
    ),
    recentFiles: createSource(recentFiles, request, whenEmpty("files")),
    titles: createSource(fileTitles, request, titleTerm),
    usergroups: createSource(usergroupMatches, request, (next) =>
      usergroupDetails() ? termFor("people")(next) : undefined,
    ),
    users: createSource(userMatches, request, termFor("all", "people")),
  };
}

export type SearchSources = ReturnType<typeof createSearchSources>;
