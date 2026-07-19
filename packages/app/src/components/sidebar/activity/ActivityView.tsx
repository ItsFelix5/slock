import type { ActivityItem } from "@slock/slack-api";
import { Icon, type IconName, Tooltip } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { store } from "../../../lib/store";
import ActivityRow, { type ActivityRow as ActivityRowData } from "./ActivityRow";
import { ACTIVITY_KIND_ICONS } from "./activityKindIcons";
import "./ActivityView.css";

type Tag = ActivityItem["kind"] | "app";
type ReadState = "all" | "unread" | "read" | "reacted";

const TAG_FILTERS: { icon: IconName; key: Tag; label: string }[] = [
  { icon: ACTIVITY_KIND_ICONS.mention, key: "mention", label: "Mentions" },
  { icon: ACTIVITY_KIND_ICONS.dm, key: "dm", label: "Direct messages" },
  { icon: ACTIVITY_KIND_ICONS.keyword, key: "keyword", label: "Pingwords" },
  { icon: ACTIVITY_KIND_ICONS.thread_reply, key: "thread_reply", label: "Threads" },
  {
    icon: ACTIVITY_KIND_ICONS.channel_mention,
    key: "channel_mention",
    label: "@channel and @here",
  },
  { icon: ACTIVITY_KIND_ICONS.usergroup_mention, key: "usergroup_mention", label: "Usergroups" },
  { icon: ACTIVITY_KIND_ICONS.channel_all, key: "channel_all", label: "All channel posts" },
  { icon: ACTIVITY_KIND_ICONS.reaction, key: "reaction", label: "Reactions" },
  { icon: "apps", key: "app", label: "Apps" },
];

const READ_STATES: { key: ReadState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
  { key: "reacted", label: "Reacted" },
];

function latestItem(row: ActivityRowData) {
  return row.items[0];
}

export default function ActivityView() {
  const [selectedTag, setSelectedTag] = createSignal<Tag | "all">("all");
  const [keyword, setKeyword] = createSignal("");
  const [readState, setReadState] = createSignal<ReadState>("all");

  // On a hard refresh landing straight on /activity, the sidebar mounts
  // before the bootstrap fetch resolves `currentUser`, so a one-shot onMount
  // would race it and never retry. Re-run once the user becomes available.
  createEffect(() => {
    if (store.users.currentUser()) store.activity.ensureActivityLoaded();
  });

  const rows = createMemo<ActivityRowData[]>(() => {
    const groups = new Map<string, ActivityRowData>();
    const ordered: ActivityRowData[] = [];
    const items = [...store.activity.activityItems].sort((a, b) => b.time - a.time);
    for (const item of items) {
      const threadTs = item.threadTs ?? (item.kind === "thread_reply" ? item.ts : undefined);
      if (!threadTs) {
        ordered.push({ isThread: false, items: [item], key: `single:${item.id}` });
        continue;
      }
      const key = `thread:${item.channelId}:${threadTs}`;
      let row = groups.get(key);
      if (!row) {
        row = { isThread: true, items: [], key };
        groups.set(key, row);
        ordered.push(row);
      }
      row.items.push(item);
    }
    return ordered;
  });

  const statusFor = (row: ActivityRowData): Exclude<ReadState, "all"> => {
    const latest = latestItem(row);
    if (store.activity.isActivityItemReacted(latest)) return "reacted";
    if (store.activity.isActivityItemUnread(latest)) return "unread";
    return "read";
  };

  const tagAndSearchRows = createMemo(() => {
    const tag = selectedTag();
    const query = keyword().trim().toLowerCase();
    return rows().filter((row) => {
      if (tag !== "all") {
        const matches = row.items.some((item) => {
          if (item.kind === tag) return true;
          return tag === "app" && !!store.users.userById(item.userId)?.isBot;
        });
        if (!matches) return false;
      }
      return !query || row.items.some((item) => item.text.toLowerCase().includes(query));
    });
  });

  const statusCounts = createMemo(() => {
    const counts: Record<Exclude<ReadState, "all">, number> = {
      reacted: 0,
      read: 0,
      unread: 0,
    };
    for (const row of tagAndSearchRows()) counts[statusFor(row)] += 1;
    return counts;
  });

  const visibleRows = createMemo(() => {
    const state = readState();
    if (state === "all") return tagAndSearchRows();
    return tagAndSearchRows().filter((row) => statusFor(row) === state);
  });

  const selectedTagLabel = createMemo(
    () => TAG_FILTERS.find((filter) => filter.key === selectedTag())?.label ?? "All activity",
  );

  return (
    <div class="activity-view">
      <div class="activity-toolbar">
        <div class="activity-search-wrap flex-align-center">
          <Icon name="search" size={15} />
          <input
            class="activity-search"
            onInput={(event) => setKeyword(event.currentTarget.value)}
            placeholder="Search activity"
            type="search"
            value={keyword()}
          />
        </div>

        <div aria-label="Activity status" class="activity-read-toggle" role="tablist">
          <For each={READ_STATES}>
            {(state) => {
              const count = () =>
                state.key === "all"
                  ? tagAndSearchRows().length
                  : statusCounts()[state.key as Exclude<ReadState, "all">];
              return (
                <button
                  aria-selected={readState() === state.key}
                  class="btn-reset"
                  classList={{ active: readState() === state.key }}
                  onClick={() => setReadState(state.key)}
                  role="tab"
                  type="button"
                >
                  {state.label}
                  <Show when={count() > 0}>
                    <span>{count()}</span>
                  </Show>
                </button>
              );
            }}
          </For>
        </div>

        <div class="activity-type-filter">
          <div aria-label="Activity type" class="activity-type-icons" role="toolbar">
            <Tooltip content="All activity">
              <button
                aria-label="All activity"
                aria-pressed={selectedTag() === "all"}
                class="activity-type-button btn-reset flex-center"
                classList={{ active: selectedTag() === "all" }}
                onClick={() => setSelectedTag("all")}
                type="button"
              >
                <Icon name="list-view" size={17} />
              </button>
            </Tooltip>
            <For each={TAG_FILTERS}>
              {(filter) => (
                <Tooltip content={filter.label}>
                  <button
                    aria-label={filter.label}
                    aria-pressed={selectedTag() === filter.key}
                    class="activity-type-button btn-reset flex-center"
                    classList={{ active: selectedTag() === filter.key }}
                    onClick={() => setSelectedTag(filter.key)}
                    type="button"
                  >
                    <Icon name={filter.icon} size={17} />
                  </button>
                </Tooltip>
              )}
            </For>
          </div>
        </div>
      </div>

      <Show
        fallback={
          <div class="activity-empty empty-state">
            <Icon name="check-circle" size={28} />
            <div>Nothing in {selectedTagLabel().toLowerCase()}.</div>
          </div>
        }
        when={visibleRows().length > 0}
      >
        <div class="activity-list">
          <For each={visibleRows()}>
            {(row) => (
              <ActivityRow
                onReacted={store.activity.markActivityItemsReacted}
                onSeen={store.activity.markActivityItemsRead}
                row={row}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
