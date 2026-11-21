import { EmojiText } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { channelIconName } from "@slock/plugins/channels/client/api";
import { deleteEntry, draftsForChannel } from "@slock/plugins/drafts/client/api";
import { blockPreviewText } from "@slock/slack";
import type { ChannelId, Ts } from "@slock/types";
import { Icon, SuggestionList } from "@slock/ui";
import { createSignal, Show } from "solid-js";
import "./DraftList.css";

const viewStore = service("conversations");
const messageLinks = service("message-links");

export default function DraftList(props: {
  channelId: ChannelId;
  close: () => void;
  kind?: "channel" | "dm";
}) {
  const [active, setActive] = createSignal<number | null>(null);
  const entries = () => draftsForChannel(props.channelId);
  const rowId = (i: number) => `draft-row-${i}`;

  const restore = (threadTs: Ts | undefined) => {
    if (threadTs) messageLinks.openThread(props.channelId, threadTs);
    else viewStore.setActiveView({ id: props.channelId, kind: props.kind ?? "channel" });
    props.close();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Delete") return;
    const row = e.target instanceof Element ? e.target.closest("[id^='draft-row-']") : null;
    const index = row ? Number(row.id.slice("draft-row-".length)) : Number.NaN;
    const entry = Number.isFinite(index) ? entries()[index] : undefined;
    if (entry) void deleteEntry(entry.key, entry.id);
  };

  return (
    <div
      class="sidebar-draft-list flex-col"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      <SuggestionList
        activeIndex={active()}
        itemId={rowId}
        items={entries()}
        onHover={setActive}
        onPick={(i) => {
          const entry = entries()[i];
          if (entry) restore(entry.threadTs);
        }}
        renderAction={(entry) => (
          <button
            class="btn-reset icon-btn sm icon-action text-dim suggestion-action"
            aria-label="Delete draft"
            onClick={() => void deleteEntry(entry.key, entry.id)}
            onMouseDown={(e) => e.preventDefault()}
            type="button"
          >
            <Icon name="trash" size={13} />
          </button>
        )}
        renderItem={(entry) => (
          <>
            <span class="suggestion-icon flex-center">
              <Show
                fallback={<Icon name={channelIconName(false)} size={12} />}
                when={entry.threadTs}
              >
                <Icon name="threads" size={12} />
              </Show>
            </span>
            <span class="suggestion-label truncate">
              <EmojiText text={blockPreviewText(entry.blocks)} />
            </span>
          </>
        )}
      />
    </div>
  );
}
