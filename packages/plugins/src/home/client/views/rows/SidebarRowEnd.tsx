import { Slot, service } from "@slock/core/solid";
import { HoverCard, Icon, Tooltip } from "@slock/ui";
import { createMemo, For, type JSX } from "solid-js";
import { channelHasDraft } from "../../../../drafts/client/api";
import { unreadSummary } from "../lib/unreadSummary";
import DraftList from "./DraftList";
import "./SidebarRow.css";

const unreadStore = service("unread");
const usersStore = service("users");
const messagesStore = service("messages");
const prefsStore = service("prefs");

export default function SidebarRowEnd(props: {
  id: string;
  kind: "channel" | "dm";
  mentions?: number;
}) {
  const unreadTooltip = createMemo(() =>
    unreadSummary({
      currentUserId: usersStore.currentUser()?.id,
      lastRead: unreadStore.lastReadFor(props.id),
      loadedMessages: messagesStore.messagesInChannel(props.id),
      mentions: props.mentions,
    }),
  );

  const cells = createMemo(() => {
    const items: JSX.Element[] = [];
    if (channelHasDraft(props.id))
      items.push(
        <HoverCard
          align="start"
          content={(close) => <DraftList channelId={props.id} close={close} kind={props.kind} />}
        >
          <Icon name="edit" size={12} />
        </HoverCard>,
      );
    if (!prefsStore.isChannelMuted(props.id) && props.mentions)
      items.push(
        <Tooltip content={unreadTooltip()}>
          <span class="sidebar-badge">{props.mentions}</span>
        </Tooltip>,
      );
    return items;
  });

  return (
    <span class="sidebar-row-end">
      <Slot id={props.id} kind={props.kind} point="home.rowEnd" />
      <For each={cells()}>{(cell) => <span class="sidebar-row-cell">{cell}</span>}</For>
    </span>
  );
}
