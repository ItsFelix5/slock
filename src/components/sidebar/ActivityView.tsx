import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import Icon from "../../icons";
import {
  activityItems,
  channelById,
  ensureActivityLoaded,
  lastActivityReadAt,
  markActivityRead,
  openChannelPeek,
  userById,
} from "../../lib/store";
import type { ActivityItem } from "../../lib/types";
import Mrkdwn from "../blockkit/mrkdwn";
import { Avatar } from "../common";
import Pronouns from "../user/Pronouns";
import "./ActivityView.css";

type Tag = ActivityItem["kind"] | "app";
type ReadState = "all" | "unread" | "read";

const TAG_FILTERS: { key: Tag; label: string }[] = [
  { key: "mention", label: "Mentions" },
  { key: "dm", label: "Direct messages" },
  { key: "thread_reply", label: "Threads" },
  { key: "channel_mention", label: "@channel & @here" },
  { key: "usergroup_mention", label: "Usergroups" },
  { key: "channel_all", label: "Channels set to notify on all messages" },
  { key: "reaction", label: "Reactions" },
  { key: "app", label: "Apps" },
];

const READ_STATES: { key: ReadState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
];

function verbFor(item: ActivityItem): string {
  switch (item.kind) {
    case "mention":
      return "mentioned you in";
    case "dm":
      return "sent you a message";
    case "thread_reply":
      return "replied to a thread in";
    case "channel_mention":
      return `mentioned @${item.broadcastRange ?? "channel"} in`;
    case "usergroup_mention":
      return "mentioned a usergroup in";
    case "channel_all":
      return "posted in";
    case "reaction":
    default:
      return "reacted to your message in";
  }
}

export default function ActivityView() {
  const [selectedTags, setSelectedTags] = createSignal<Set<Tag>>(new Set());
  const [keyword, setKeyword] = createSignal("");
  const [readState, setReadState] = createSignal<ReadState>("all");
  const [filterOpen, setFilterOpen] = createSignal(false);

  onMount(() => ensureActivityLoaded());

  const toggleTag = (tag: Tag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const items = createMemo(() => {
    const sorted = [...activityItems].sort((a, b) => b.time - a.time);
    const tags = selectedTags();
    const kw = keyword().trim().toLowerCase();
    const read = readState();
    const cutoff = lastActivityReadAt();

    return sorted.filter((item) => {
      if (tags.size > 0) {
        const itemTags: Tag[] = [item.kind];
        if (userById(item.userId)?.isBot) itemTags.push("app");
        if (!itemTags.some((t) => tags.has(t))) return false;
      }
      if (kw && !item.text.toLowerCase().includes(kw)) return false;
      const unread = item.time > cutoff;
      if (read === "unread" && !unread) return false;
      if (read === "read" && unread) return false;
      return true;
    });
  });

  const goTo = (channelId: string, ts: string) => openChannelPeek(channelId, ts);

  return (
    <div class="activity-view">
      <div class="activity-view-header">
        <h2>Activity</h2>
        <button class="activity-mark-read" onClick={markActivityRead}>
          Mark all as read
        </button>
      </div>

      <div class="activity-toolbar">
        <input
          class="activity-search"
          type="text"
          placeholder="Filter by keyword"
          value={keyword()}
          onInput={(e) => setKeyword(e.currentTarget.value)}
        />

        <div class="activity-read-toggle">
          <For each={READ_STATES}>
            {(r) => (
              <button
                classList={{ active: readState() === r.key }}
                onClick={() => setReadState(r.key)}
              >
                {r.label}
              </button>
            )}
          </For>
        </div>

        <div class="activity-filter-wrap">
          <button
            class="activity-filter-toggle"
            classList={{ active: selectedTags().size > 0 }}
            onClick={() => setFilterOpen(!filterOpen())}
          >
            Filter
            <Show when={selectedTags().size > 0}>
              <span class="activity-filter-count">{selectedTags().size}</span>
            </Show>
            <Icon name="caret-down-filled" size={14} />
          </button>
          <Show when={filterOpen()}>
            <>
              <div class="activity-filter-scrim" onClick={() => setFilterOpen(false)} />
              <div class="activity-filter-panel">
                <For each={TAG_FILTERS}>
                  {(f) => (
                    <label class="activity-filter-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedTags().has(f.key)}
                        onChange={() => toggleTag(f.key)}
                      />
                      {f.label}
                    </label>
                  )}
                </For>
                <Show when={selectedTags().size > 0}>
                  <button class="activity-filter-clear" onClick={() => setSelectedTags(new Set())}>
                    Clear filters
                  </button>
                </Show>
              </div>
            </>
          </Show>
        </div>
      </div>

      <Show
        when={items().length > 0}
        fallback={<div class="activity-empty">Nothing here yet.</div>}
      >
        <For each={items()}>
          {(item) => {
            const user = createMemo(() => userById(item.userId));
            const channel = createMemo(() => channelById(item.channelId));
            const isUnread = createMemo(() => item.time > lastActivityReadAt());
            return (
              <button
                class="activity-item"
                classList={{ unread: isUnread() }}
                onClick={() => goTo(item.channelId, item.ts)}
              >
                <span class="activity-unread-dot" />
                <Show when={user()}>
                  {(u) => (
                    <Avatar
                      user={{
                        ...u(),
                        avatarColor: u().avatarColor ?? "#616061",
                      }}
                      size="small"
                    />
                  )}
                </Show>
                <div class="activity-body">
                  <div class="activity-headline">
                    <strong>{user()?.name ?? "Someone"}</strong>
                    <Pronouns text={user()?.pronouns} /> {verbFor(item)}{" "}
                    <Show when={item.kind !== "dm"}>
                      <span class="activity-channel">#{channel()?.name ?? item.channelId}</span>
                    </Show>
                  </div>
                  <div class="activity-snippet">
                    <Mrkdwn text={item.text} />
                  </div>
                  <div class="activity-time">
                    {new Date(item.time).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
              </button>
            );
          }}
        </For>
      </Show>
    </div>
  );
}
