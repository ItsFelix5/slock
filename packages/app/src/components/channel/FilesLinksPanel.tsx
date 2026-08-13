import type { SlackFile, SlackLink } from "@slock/slack-api";
import { Button, Icon, type IconName, Tooltip, useEscapeClose } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { FilesLinksEntry } from "../../lib/filesLinksPanel";
import {
  closeFilesLinksPanel,
  filesLinksChannelId,
  filesLinksEntries,
  filesLinksLoadError,
  filesLinksLoading,
  filesLinksQuery,
  loadMoreFilesLinks,
  retryFilesLinks,
  setFilesLinksQuery,
} from "../../lib/filesLinksPanel";
import { store } from "../../lib/store";
import { formatSize } from "../messages/parts/media/MessageFiles";
import FileDetailModal from "./FileDetailModal";
import "./FilesLinksPanel.css";

const WWW_PREFIX_RE = /^www\./;

type TypeFilter = "all" | "images" | "files" | "links";
type SortMode = "newest" | "oldest" | "name";

const TYPE_FILTERS: { label: string; value: TypeFilter }[] = [
  { label: "All", value: "all" },
  { label: "Images", value: "images" },
  { label: "Files", value: "files" },
  { label: "Links", value: "links" },
];

function fileIconName(file: SlackFile): IconName {
  if (file.isPdf) return "pdf-file";
  if (file.isVideo) return "video";
  if (file.isMail) return "email";
  if (file.isAudio) return "sound";
  return "file";
}

function formatDate(seconds: number | undefined): string {
  if (!seconds) return "";
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function monthLabel(seconds: number): string {
  if (!seconds) return "Undated";
  return new Date(seconds * 1000).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function linkDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(WWW_PREFIX_RE, "");
  } catch {
    return url;
  }
}

function entryTitle(entry: FilesLinksEntry): string {
  return entry.kind === "file"
    ? entry.file.title || entry.file.name || ""
    : entry.link.title || entry.link.url;
}

function matchesTypeFilter(entry: FilesLinksEntry, filter: TypeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "links") return entry.kind === "link";
  if (entry.kind !== "file") return false;
  return filter === "images" ? entry.file.isImage : !entry.file.isImage;
}

function groupByMonth(entries: FilesLinksEntry[]): { entries: FilesLinksEntry[]; label: string }[] {
  const groups: { entries: FilesLinksEntry[]; label: string }[] = [];
  for (const entry of entries) {
    const label = monthLabel(entry.sortTs);
    const current = groups.at(-1);
    if (current?.label === label) current.entries.push(entry);
    else groups.push({ entries: [entry], label });
  }
  return groups;
}

function FileCard(props: { file: SlackFile; onOpen: (file: SlackFile) => void }) {
  return (
    <button
      class="files-links-card btn-reset"
      data-nav-row
      onClick={() => props.onOpen(props.file)}
      type="button"
    >
      <Show
        fallback={
          <span class="files-links-card-icon">
            <Icon name={fileIconName(props.file)} size={26} />
          </span>
        }
        when={props.file.isImage && props.file.thumbUrl}
      >
        {(thumb) => <img alt="" class="files-links-card-thumb" src={thumb()} />}
      </Show>
      <span class="files-links-card-body">
        <span class="files-links-card-title truncate">{props.file.title || props.file.name}</span>
        <span class="files-links-card-meta text-dim truncate">
          {[
            props.file.filetype?.toUpperCase(),
            formatSize(props.file.size),
            formatDate(props.file.created),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </button>
  );
}

function LinkCard(props: { channelId: string; link: SlackLink }) {
  const jumpToMessage = (e: MouseEvent) => {
    e.preventDefault();
    closeFilesLinksPanel();
    store.viewState.openChannelMessage(props.channelId, props.link.ts, { keepNav: true });
  };
  return (
    <div class="files-links-card files-links-card-link">
      <a
        class="files-links-card-open"
        data-nav-row
        href={props.link.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Show
          fallback={
            <span class="files-links-card-icon">
              <Icon name="link" size={22} />
            </span>
          }
          when={props.link.iconUrl ?? props.link.thumbUrl}
        >
          {(icon) => <img alt="" class="files-links-card-favicon" src={icon()} />}
        </Show>
        <span class="files-links-card-body">
          <span class="files-links-card-title truncate">{props.link.title || props.link.url}</span>
          <span class="files-links-card-meta text-dim truncate">{linkDomain(props.link.url)}</span>
        </span>
      </a>
      <Tooltip content="Jump to message">
        <button class="files-links-card-jump btn-reset" onClick={jumpToMessage} type="button">
          <Icon name="message" size={13} />
        </button>
      </Tooltip>
    </div>
  );
}

function EntryGrid(props: {
  channelId: string;
  entries: FilesLinksEntry[];
  onOpenFile: (file: SlackFile) => void;
}) {
  return (
    <div class="files-links-grid">
      <For each={props.entries}>
        {(entry) =>
          entry.kind === "file" ? (
            <FileCard file={entry.file} onOpen={props.onOpenFile} />
          ) : (
            <LinkCard channelId={props.channelId} link={entry.link} />
          )
        }
      </For>
    </div>
  );
}

export default function FilesLinksPanel() {
  useEscapeClose(closeFilesLinksPanel, () => !!filesLinksChannelId());
  const [typeFilter, setTypeFilter] = createSignal<TypeFilter>("all");
  const [sortMode, setSortMode] = createSignal<SortMode>("newest");
  const [openFile, setOpenFile] = createSignal<SlackFile | null>(null);

  const filtered = createMemo(() => {
    const filter = typeFilter();
    return filesLinksEntries().filter((entry) => matchesTypeFilter(entry, filter));
  });

  const sorted = createMemo(() => {
    const mode = sortMode();
    if (mode === "newest") return filtered();
    const list = [...filtered()];
    if (mode === "oldest") list.sort((a, b) => a.sortTs - b.sortTs);
    else list.sort((a, b) => entryTitle(a).localeCompare(entryTitle(b)));
    return list;
  });

  const groups = createMemo(() => (sortMode() === "name" ? null : groupByMonth(sorted())));

  const searchMessagesInstead = () => {
    const channelId = filesLinksChannelId();
    if (!channelId) return;
    const query = filesLinksQuery();
    closeFilesLinksPanel();
    store.viewState.openMessageSearch(query, { inChannelId: channelId });
  };

  const onSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") searchMessagesInstead();
  };

  const loadMoreAtBottom = (body: HTMLDivElement) => {
    if (body.scrollTop + body.clientHeight >= body.scrollHeight - 160) loadMoreFilesLinks();
  };

  return (
    <Show when={filesLinksChannelId()}>
      {(id) => (
        <div class="files-links-view flex-col">
          <div class="files-links-toolbar">
            <div class="files-links-searchbar">
              <Icon class="files-links-search-icon" name="search" size={14} />
              <input
                class="files-links-search-input input-reset"
                onInput={(e) => setFilesLinksQuery(e.currentTarget.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Filter files & links, Enter to search messages"
                type="text"
                value={filesLinksQuery()}
              />
            </div>
            <fieldset class="files-links-filters">
              <For each={TYPE_FILTERS}>
                {(f) => (
                  <button
                    class="files-links-filter-chip"
                    classList={{ active: typeFilter() === f.value }}
                    onClick={() => setTypeFilter(f.value)}
                    type="button"
                  >
                    {f.label}
                  </button>
                )}
              </For>
            </fieldset>
            <select
              class="files-links-sort-select input-reset"
              onChange={(e) => setSortMode(e.currentTarget.value as SortMode)}
              value={sortMode()}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
            </select>
          </div>
          <div class="files-links-body" onScroll={(e) => loadMoreAtBottom(e.currentTarget)}>
            <Show
              when={
                filesLinksLoading() && filesLinksEntries().length === 0 && !filesLinksLoadError()
              }
            >
              <div class="files-links-empty empty-state">Loading files & links…</div>
            </Show>
            <Show when={filesLinksLoadError()}>
              <div class="files-links-empty empty-state">
                <span>Couldn't load files & links.</span>
                <Button onClick={retryFilesLinks} size="sm">
                  Try again
                </Button>
              </div>
            </Show>
            <Show when={!filesLinksLoadError()}>
              <Show when={sorted().length === 0 && !filesLinksLoading()}>
                <div class="files-links-empty empty-state">
                  {filesLinksQuery() || typeFilter() !== "all"
                    ? "No files or links match."
                    : "No files or links yet."}
                </div>
              </Show>
              <Show
                fallback={
                  <EntryGrid channelId={id()} entries={sorted()} onOpenFile={setOpenFile} />
                }
                when={groups()}
              >
                {(groupList) => (
                  <For each={groupList()}>
                    {(group) => (
                      <div class="files-links-group">
                        <div class="files-links-group-label">{group.label}</div>
                        <EntryGrid
                          channelId={id()}
                          entries={group.entries}
                          onOpenFile={setOpenFile}
                        />
                      </div>
                    )}
                  </For>
                )}
              </Show>
            </Show>
            <Show when={filesLinksLoading() && filesLinksEntries().length > 0}>
              <div class="files-links-loading-more text-dim text-sm">Loading more…</div>
            </Show>
          </div>
          <Show when={openFile()}>
            {(file) => <FileDetailModal file={file()} onClose={() => setOpenFile(null)} />}
          </Show>
        </div>
      )}
    </Show>
  );
}
