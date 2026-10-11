import { service } from "@slock/core/solid";
import {
  Button,
  Icon,
  initRovingTabIndexDefault,
  inside,
  isOneOf,
  useConfirmShortcut,
  useEscapeClose,
} from "@slock/ui";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
  groupByMonth,
  type MonthGroup,
  matchesTypeFilter,
  SORT_MODES,
  type SortMode,
  sortEntries,
  type TypeFilter,
} from "../lib/panelView";
import { EntryGrid } from "./EntryGrid";
import "./FilesLinksPanel.css";

const filesPanel = service("files-panel");

const searchStore = service("search");

const TYPE_FILTERS: { label: string; value: TypeFilter }[] = [
  { label: "All", value: "all" },
  { label: "Images", value: "images" },
  { label: "Files", value: "files" },
  { label: "Links", value: "links" },
];

export default function FilesLinksPanel() {
  let bodyRef: HTMLDivElement | undefined;
  let searchInputRef: HTMLInputElement | undefined;
  useEscapeClose(filesPanel.closeFilesLinksPanel, () => !!filesPanel.filesLinksChannelId());
  const [typeFilter, setTypeFilter] = createSignal<TypeFilter>("all");
  const [sortMode, setSortMode] = createSignal<SortMode>("newest");
  const files = service("files");

  const filtered = createMemo(() => {
    const filter = typeFilter();
    return filesPanel.filesLinksEntries().filter((entry) => matchesTypeFilter(entry, filter));
  });

  const sorted = createMemo(() => sortEntries(filtered(), sortMode()));

  const groupsCache = new Map<string, MonthGroup>();
  const groups = createMemo(() =>
    sortMode() === "name" ? null : groupByMonth(sorted(), groupsCache),
  );

  initRovingTabIndexDefault(() => bodyRef, sorted);

  const searchMessagesInstead = () => {
    const channelId = filesPanel.filesLinksChannelId();
    if (!channelId) return;
    const query = filesPanel.filesLinksQuery();
    filesPanel.closeFilesLinksPanel();
    searchStore.openSearch(query, { inChannelId: channelId });
  };

  useConfirmShortcut(searchMessagesInstead, { target: inside(() => searchInputRef) });

  const loadMoreAtBottom = (body: HTMLDivElement) => {
    if (body.scrollTop + body.clientHeight >= body.scrollHeight - 160)
      filesPanel.loadMoreFilesLinks();
  };

  createEffect(() => {
    sorted();
    if (filesPanel.filesLinksLoading() || !bodyRef) return;
    queueMicrotask(() => bodyRef && loadMoreAtBottom(bodyRef));
  });

  return (
    <Show when={filesPanel.filesLinksChannelId()}>
      {(id) => (
        <div class="files-links-view flex-col">
          <div class="files-links-toolbar flex-align-center">
            <div class="files-links-searchbar">
              <Icon class="files-links-search-icon" name="search" size={14} />
              <input
                class="files-links-search-input input-reset input-plain"
                onInput={(e) => filesPanel.setFilesLinksQuery(e.currentTarget.value)}
                placeholder="Filter files & links, Enter to search messages"
                ref={searchInputRef}
                type="text"
                value={filesPanel.filesLinksQuery()}
              />
            </div>
            <Show when={filesPanel.filesLinksEntries().length > 0}>
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
                onChange={(e) => {
                  const { value } = e.currentTarget;
                  if (isOneOf(value, SORT_MODES)) setSortMode(value);
                }}
                value={sortMode()}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name">Name</option>
              </select>
            </Show>
          </div>
          <div
            class="files-links-body"
            onScroll={(e) => loadMoreAtBottom(e.currentTarget)}
            ref={bodyRef}
          >
            <Show
              when={
                filesPanel.filesLinksLoading() &&
                filesPanel.filesLinksEntries().length === 0 &&
                !filesPanel.filesLinksLoadError()
              }
            >
              <div class="files-links-empty flex-col empty-state">Loading files & links…</div>
            </Show>
            <Show when={filesPanel.filesLinksLoadError()}>
              <div class="files-links-empty flex-col empty-state">
                <span>Couldn't load files & links.</span>
                <Button onClick={filesPanel.retryFilesLinks} size="sm">
                  Try again
                </Button>
              </div>
            </Show>
            <Show when={!filesPanel.filesLinksLoadError()}>
              <Show when={sorted().length === 0 && !filesPanel.filesLinksLoading()}>
                <div class="files-links-empty flex-col empty-state">
                  {filesPanel.filesLinksQuery() || typeFilter() !== "all"
                    ? "No files or links match."
                    : "No files or links yet."}
                </div>
              </Show>
              <Show
                fallback={<EntryGrid channelId={id()} entries={sorted()} onOpenFile={files.open} />}
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
                          onOpenFile={files.open}
                        />
                      </div>
                    )}
                  </For>
                )}
              </Show>
            </Show>
            <Show
              when={filesPanel.filesLinksLoading() && filesPanel.filesLinksEntries().length > 0}
            >
              <div class="files-links-loading-more text-dim text-sm">Loading more…</div>
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}
