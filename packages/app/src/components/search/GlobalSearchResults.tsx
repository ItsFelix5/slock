import type { DirectMessage, User } from "@slock/slack-api";
import { Avatar, AvatarStack, Icon } from "@slock/ui";
import { For, Show } from "solid-js";
import { dmDisplayName, store } from "../../lib/store";

export interface JumpChannel {
  id: string;
  joined: boolean;
  name: string;
  private: boolean;
}

export type GlobalSearchRow =
  | { kind: "channel"; data: JumpChannel }
  | { kind: "person"; data: User }
  | { kind: "dm"; data: DirectMessage };

export default function GlobalSearchResults(props: {
  activeIndex: number | null;
  hasQuery: boolean;
  listboxId: string;
  onActiveIndex: (index: number) => void;
  onChannel: (channel: JumpChannel) => void;
  onDm: (dm: DirectMessage) => void;
  onMessageSearch: () => void;
  onPerson: (userId: string) => void;
  query: string;
  rows: GlobalSearchRow[];
  searching: boolean;
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
        <div
          aria-busy={props.searching}
          aria-label="Search suggestions"
          class="global-search-options"
          id={props.listboxId}
          role="listbox"
        >
          <button
            aria-selected={props.activeIndex === 0}
            class="global-search-result global-search-message-action btn-reset flex-align-center"
            classList={{ active: props.activeIndex === 0 }}
            id={optionId(0)}
            onClick={props.onMessageSearch}
            onMouseEnter={() => props.onActiveIndex(0)}
            role="option"
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
                  <button
                    aria-selected={props.activeIndex === itemIndex()}
                    class="global-search-result global-search-jump btn-reset flex-align-center"
                    classList={{ active: props.activeIndex === itemIndex() }}
                    id={optionId(itemIndex())}
                    onClick={() => props.onChannel(channel)}
                    onMouseEnter={() => props.onActiveIndex(itemIndex())}
                    role="option"
                    tabIndex={-1}
                    type="button"
                  >
                    <span class="global-search-jump-icon">
                      {channel.private ? <Icon name="lock" size={13} /> : "#"}
                    </span>
                    {channel.name}
                  </button>
                );
              }
              if (row.kind === "dm") {
                const dm = row.data;
                const members = (dm.memberIds ?? [])
                  .map((id) => store.users.userById(id))
                  .filter((member) => member !== undefined);
                return (
                  <button
                    aria-selected={props.activeIndex === itemIndex()}
                    class="global-search-result global-search-jump btn-reset flex-align-center"
                    classList={{ active: props.activeIndex === itemIndex() }}
                    id={optionId(itemIndex())}
                    onClick={() => props.onDm(dm)}
                    onMouseEnter={() => props.onActiveIndex(itemIndex())}
                    role="option"
                    tabIndex={-1}
                    type="button"
                  >
                    <AvatarStack max={3} size="small" users={members} />
                    {dmDisplayName(dm, store.users.userById)}
                  </button>
                );
              }
              const user = row.data;
              return (
                <button
                  aria-selected={props.activeIndex === itemIndex()}
                  class="global-search-result global-search-jump btn-reset flex-align-center"
                  classList={{ active: props.activeIndex === itemIndex() }}
                  id={optionId(itemIndex())}
                  onClick={() => props.onPerson(user.id)}
                  onMouseEnter={() => props.onActiveIndex(itemIndex())}
                  role="option"
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
          <div aria-live="polite" class="global-search-status empty-state">
            {props.status}
          </div>
        </Show>
      </Show>
    </div>
  );
}
