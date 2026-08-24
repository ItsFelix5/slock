import { Avatar, AvatarStack, Icon } from "@slock/ui";
import { For, Show } from "solid-js";
import type { DirectMessage, SlackFile, User } from "../../lib/api";
import { channelIconName, dmDisplayName } from "../../lib/displayName";
import { store } from "../../lib/store";
import { openConversationInSplit, SplitNavigation } from "../navigation/SplitNavigation";

export interface JumpChannel {
  id: string;
  joined: boolean;
  name: string;
  private: boolean;
}

export type GlobalSearchRow =
  | { kind: "channel"; data: JumpChannel }
  | { kind: "person"; data: User }
  | { kind: "dm"; data: DirectMessage }
  | { kind: "file"; data: SlackFile };

export default function GlobalSearchResults(props: {
  activeIndex: number | null;
  hasQuery: boolean;
  listboxId: string;
  onActiveIndex: (index: number) => void;
  onChannel: (channel: JumpChannel) => void;
  onDm: (dm: DirectMessage) => void;
  onFile: (file: SlackFile) => void;
  onMessageSearch: () => void;
  onPerson: (userId: string) => void;
  query: string;
  rows: GlobalSearchRow[];
  status: string;
}) {
  const optionId = (index: number) => `${props.listboxId}-option-${index}`;

  return (
    <div class="global-search-results">
      <Show
        fallback={
          <div class="global-search-hint empty-state">Jump to a channel or person. (Ctrl+K)</div>
        }
        when={props.hasQuery}
      >
        <div class="global-search-options" id={props.listboxId}>
          <button
            class="global-search-result global-search-message-action btn-reset flex-align-center"
            classList={{ active: props.activeIndex === 0 }}
            id={optionId(0)}
            onClick={props.onMessageSearch}
            onMouseEnter={() => props.onActiveIndex(0)}
            tabIndex={-1}
            type="button"
          >
            <span class="global-search-jump-icon">
              <Icon name="search" size={13} />
            </span>
            Search all messages for "{props.query}"
          </button>
          <For each={props.rows}>
            {(row, index) => {
              const itemIndex = () => index() + 1;
              if (row.kind === "channel") {
                const channel = row.data;
                return (
                  <SplitNavigation onSplit={() => openConversationInSplit(channel.id)}>
                    <button
                      class="global-search-result global-search-jump btn-reset flex-align-center"
                      classList={{ active: props.activeIndex === itemIndex() }}
                      id={optionId(itemIndex())}
                      onClick={() => props.onChannel(channel)}
                      onMouseEnter={() => props.onActiveIndex(itemIndex())}
                      tabIndex={-1}
                      type="button"
                    >
                      <span class="global-search-jump-icon">
                        <Icon name={channelIconName(channel.private)} size={13} />
                      </span>
                      {channel.name}
                    </button>
                  </SplitNavigation>
                );
              }
              if (row.kind === "dm") {
                const dm = row.data;
                const members = (dm.memberIds ?? [])
                  .map((id) => store.users.userById(id))
                  .filter((member) => member !== undefined);
                return (
                  <SplitNavigation onSplit={() => openConversationInSplit(dm.id)}>
                    <button
                      class="global-search-result global-search-jump btn-reset flex-align-center"
                      classList={{ active: props.activeIndex === itemIndex() }}
                      id={optionId(itemIndex())}
                      onClick={() => props.onDm(dm)}
                      onMouseEnter={() => props.onActiveIndex(itemIndex())}
                      tabIndex={-1}
                      type="button"
                    >
                      <AvatarStack max={3} size="small" users={members} />
                      {dmDisplayName(dm, store.users.userById)}
                    </button>
                  </SplitNavigation>
                );
              }
              if (row.kind === "file") {
                const file = row.data;
                return (
                  <button
                    class="global-search-result global-search-jump btn-reset flex-align-center"
                    classList={{ active: props.activeIndex === itemIndex() }}
                    id={optionId(itemIndex())}
                    onClick={() => props.onFile(file)}
                    onMouseEnter={() => props.onActiveIndex(itemIndex())}
                    tabIndex={-1}
                    type="button"
                  >
                    <span class="global-search-jump-icon">
                      <Icon name={file.isImage ? "image" : "file"} size={13} />
                    </span>
                    <span class="global-search-file-name truncate">{file.title || file.name}</span>
                    <span class="global-search-file-meta text-dim truncate">
                      {file.filetype?.toUpperCase()}
                    </span>
                  </button>
                );
              }
              const user = row.data;
              return (
                <button
                  class="global-search-result global-search-jump btn-reset flex-align-center"
                  classList={{ active: props.activeIndex === itemIndex() }}
                  id={optionId(itemIndex())}
                  onClick={() => props.onPerson(user.id)}
                  onMouseEnter={() => props.onActiveIndex(itemIndex())}
                  tabIndex={-1}
                  type="button"
                >
                  <Avatar size="small" user={user} />
                  {user.name}
                </button>
              );
            }}
          </For>
        </div>
        <Show when={props.status}>
          <div class="global-search-status empty-state">{props.status}</div>
        </Show>
      </Show>
    </div>
  );
}
