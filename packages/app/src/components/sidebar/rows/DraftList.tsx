import { blockPreviewText } from "@slock/types";
import { Icon } from "@slock/ui";
import { For, Show } from "solid-js";
import { channelIconName } from "../../../lib/displayName";
import { store } from "../../../lib/store";
import { deleteEntry, draftsForChannel } from "../../composer/lib/drafts";
import "./DraftList.css";

export default function DraftList(props: {
  channelId: string;
  close: () => void;
  kind?: "channel" | "dm";
}) {
  const restore = (threadTs: string | undefined) => {
    if (threadTs) store.viewState.openThread(props.channelId, threadTs);
    else store.viewState.setActiveView({ id: props.channelId, kind: props.kind ?? "channel" });
    props.close();
  };

  return (
    <div class="sidebar-draft-list flex-col" onClick={(e) => e.stopPropagation()}>
      <For each={draftsForChannel(props.channelId)}>
        {(entry) => (
          <div
            class="suggestion-item"
            onKeyDown={(e) => {
              if (e.key === "Delete") void deleteEntry(entry.key, entry.id);
            }}
          >
            <button
              class="suggestion-row btn-reset flex-align-center"
              onClick={() => restore(entry.threadTs)}
              type="button"
            >
              <span class="suggestion-icon flex-center">
                <Show
                  fallback={<Icon name={channelIconName(false)} size={12} />}
                  when={entry.threadTs}
                >
                  <Icon name="threads" size={12} />
                </Show>
              </span>
              <span class="suggestion-label truncate">
                {blockPreviewText(entry.blocks ?? []) || entry.text}
              </span>
            </button>
            <button
              class="btn-reset icon-btn sm icon-action text-dim suggestion-action"
              aria-label="Delete draft"
              onClick={() => void deleteEntry(entry.key, entry.id)}
              type="button"
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
