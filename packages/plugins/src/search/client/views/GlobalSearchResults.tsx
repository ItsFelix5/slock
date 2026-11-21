import { service } from "@slock/core/solid";
import { channelIconName } from "@slock/plugins/channels/client/api";
import { openConversationInSplit } from "@slock/plugins/conversations/client/api/nav";
import { SplitNavigation } from "@slock/plugins/shell/client/api/SplitNavigation";
import type { ChannelId, DirectMessage, SlackFile, User, UserId } from "@slock/types";
import { Avatar, AvatarStack, Icon } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";

const dmsStore = service("dms");
const titles = service("titles");
const usersStore = service("users");

export interface JumpChannel {
  id: ChannelId;
  joined: boolean;
  name: string;
  private: boolean;
}

export type GlobalSearchRow =
  | { kind: "channel"; data: JumpChannel }
  | { kind: "person"; data: User }
  | { kind: "dm"; data: DirectMessage }
  | { kind: "file"; data: SlackFile };

function ResultButton(props: {
  active: boolean;
  children: JSX.Element;
  class: string;
  id: string;
  onActivate: () => void;
  onHover: () => void;
}) {
  return (
    <button
      class={[
        "global-search-result btn-reset flex-align-center",
        props.class,
        { active: props.active },
      ]}
      id={props.id}
      onClick={props.onActivate}
      onMouseEnter={props.onHover}
      tabindex={-1}
      type="button"
    >
      {props.children}
    </button>
  );
}

export default function GlobalSearchResults(props: {
  activeIndex: number | null;
  hasQuery: boolean;
  listboxId: string;
  onActiveIndex: (index: number) => void;
  onChannel: (channel: JumpChannel) => void;
  onDm: (dm: DirectMessage) => void;
  onFile: (file: SlackFile) => void;
  onMessageSearch: () => void;
  onPerson: (userId: UserId) => void;
  query: string;
  rows: GlobalSearchRow[];
  status: string;
}) {
  const optionId = (index: number) => `${props.listboxId}-option-${index}`;

  return (
    <div class="global-search-results flex-col gap-xs">
      <Show when={props.hasQuery || props.rows.length > 0}>
        <div class="global-search-options flex-col gap-xs" id={props.listboxId}>
          <Show when={props.hasQuery}>
            <ResultButton
              active={props.activeIndex === 0}
              class="global-search-message-action"
              id={optionId(0)}
              onActivate={props.onMessageSearch}
              onHover={() => props.onActiveIndex(0)}
            >
              <span class="global-search-jump-icon">
                <Icon name="search" size={13} />
              </span>
              Search all messages for "{props.query}"
            </ResultButton>
          </Show>
          <For each={props.rows}>
            {(row, index) => {
              const itemIndex = () => index() + (props.hasQuery ? 1 : 0);
              const rowProps = () => ({
                active: props.activeIndex === itemIndex(),
                class: "global-search-jump",
                id: optionId(itemIndex()),
                onHover: () => props.onActiveIndex(itemIndex()),
              });
              if (row.kind === "channel") {
                const channel = row.data;
                return (
                  <SplitNavigation onSplit={() => openConversationInSplit(channel.id)}>
                    <ResultButton {...rowProps()} onActivate={() => props.onChannel(channel)}>
                      <span class="global-search-jump-icon">
                        <Icon name={channelIconName(channel.private)} size={13} />
                      </span>
                      {channel.name}
                    </ResultButton>
                  </SplitNavigation>
                );
              }
              if (row.kind === "dm") {
                const dm = row.data;
                const members = (dm.memberIds ?? [])
                  .map((id) => usersStore.userById(id))
                  .filter((member) => member !== undefined);
                return (
                  <SplitNavigation onSplit={() => openConversationInSplit(dm.id)}>
                    <ResultButton {...rowProps()} onActivate={() => props.onDm(dm)}>
                      <AvatarStack max={3} size="small" users={members} />
                      {titles.title(dm.id)}
                    </ResultButton>
                  </SplitNavigation>
                );
              }
              if (row.kind === "file") {
                const file = row.data;
                return (
                  <ResultButton {...rowProps()} onActivate={() => props.onFile(file)}>
                    <span class="global-search-jump-icon">
                      <Icon name={file.isImage ? "image" : "file"} size={13} />
                    </span>
                    <span class="global-search-file-name truncate">{file.title || file.name}</span>
                    <span class="global-search-file-meta text-dim truncate">
                      {file.filetype?.toUpperCase()}
                    </span>
                  </ResultButton>
                );
              }
              const user = row.data;
              return (
                <SplitNavigation onSplit={() => dmsStore.openDmWithUser(user.id, { split: true })}>
                  <ResultButton {...rowProps()} onActivate={() => props.onPerson(user.id)}>
                    <Avatar size="small" user={user} />
                    {user.name}
                  </ResultButton>
                </SplitNavigation>
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
