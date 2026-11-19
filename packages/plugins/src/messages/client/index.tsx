import { BlockKitResolverContext } from "@slock/blockkit";
import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { narrowPaneContent, type Pane } from "@slock/ui";
import { createSignal, Show } from "solid-js";
import type { View } from "../../conversations/client/api/types";
import { parseSlackPermalink } from "../../message-links/client/api/slackPermalink";
import type { PaneContent } from "../../shell/client/api/types";
import { liveOnly } from "./api/deletedMessages";
import { clearActiveMessageFocus } from "./api/messageFocus";
import { forgetScrollAnchors } from "./api/pane/scroll/rememberedAnchors";
import { createBlockKitResolver } from "./blockKitResolver";
import { installDocumentTitle } from "./documentTitle";
import { createEntitySource } from "./entitySource";
import { createMessagesStore } from "./store";
import { createMessageEvents } from "./store/events";
import { useMessageShortcuts } from "./useMessageShortcuts";
import ConversationPane from "./views/ConversationPane";
import EditButton from "./views/EditButton";
import FeedbackBody from "./views/FeedbackBody";
import MarkReadItem from "./views/MarkReadItem";
import { CopyTextItem, DeleteItem, EditItem, MarkUnreadItem } from "./views/messageMenuItems";
import MessageLinkHoverCard, {
  attachmentToHoverPreview,
  messageToHoverPreview,
} from "./views/parts/MessageLinkHoverCard";
import MessageLinkMentionCard from "./views/parts/MessageLinkMentionCard";

function ConversationView(props: { pane: Pane<PaneContent | null> }) {
  return (
    <Show keyed when={narrowPaneContent<PaneContent, View>(props.pane, ["channel", "dm"])}>
      {(pane) => <ConversationPane pane={pane} />}
    </Show>
  );
}

const setup: Setup = (ctx) => {
  const channels = service("channels");
  const dms = service("dms");
  const users = service("users");
  const unread = service("unread");
  const titles = service("titles");
  const panes = service("shell.panes");
  const conversations = service("conversations");
  const threadsIn = (list: ReturnType<typeof panes.panes>) =>
    list.flatMap(({ content }) =>
      content?.kind === "thread"
        ? [{ channelId: content.channelId, highlightTs: content.highlightTs, ts: content.ts }]
        : [],
    );
  const visibleThreads = () => threadsIn(panes.panes());
  const mountedThreads = () => threadsIn(panes.mountedPanes());
  ctx.add("composer.mentionCard", MessageLinkMentionCard);
  const deletedHooks = ctx.use("messages.deleted");
  const patchHooks = ctx.use("messages.patch");
  const retainHooks = ctx.use("messages.retain");
  const messages = createMessagesStore({
    clearChannelUnread: unread.clearChannelUnread,
    currentUser: users.currentUser,
    extendPatch: (current, patch) =>
      Object.assign({}, ...patchHooks().map((hook) => hook(current, patch))),
    lastReadFor: unread.lastReadFor,
    onConversationView: (view) => {
      channels.patchChannel(view.channel.id, view.channel);
      users.cacheUsers(view.users);
    },
    onMessageDeleted: (channelId, ts) => {
      for (const hook of deletedHooks()) hook(channelId, ts);
    },
    retainsDeleted: (msg) => retainHooks().some((retain) => retain(msg)),
    setChannelRead: unread.setChannelRead,
    setLastReadByChannel: unread.setLastReadByChannel,
    setThreadRead: unread.setThreadRead,
    threadReadTsFor: unread.threadReadTsFor,
    setUnreadChannelIds: unread.setUnreadChannelIds,
    setUnreadDividerTs: unread.setUnreadDividerTs,
    syncChannelRead: unread.syncChannelRead,
    unreadDividerTsFor: unread.unreadDividerTsForChannel,
    visibleMessageTargets: conversations.visibleMessageTargets,
    visibleThreads: mountedThreads,
    visibleViews: conversations.mountedViews,
  });
  ctx.provide("messages", messages);
  ctx.add("messages.prefetch", messages.prefetchHistory);
  ctx.onCleanup(forgetScrollAnchors);
  ctx.onCleanup(clearActiveMessageFocus);
  installDocumentTitle();
  useMessageShortcuts();
  unread.wireReadTracking({
    hasNewerHistory: messages.hasNewerHistory,
    messagesByChannel: messages.messagesByChannel,
    threadMessages: messages.threadMessages,
    visibleThreads,
    visibleViews: conversations.visibleViews,
  });
  const events = createMessageEvents(messages, { channels, conversations, dms, unread, users });
  for (const handler of events.handlers) ctx.add("realtime.handler", handler);
  ctx.add("realtime.reconnect", events.onReconnect);
  const tabLabel = (content: PaneContent) =>
    content.kind === "channel" || content.kind === "dm" ? titles.label(content.id) : "…";

  ctx.add(
    "shell.pane",
    {
      primary: true,
      kind: "channel",
      size: 0.5,
      singleton: false,
      tabLabel,
      url: {
        parse: (segment) => ({ id: segment, kind: "channel" }),
        serialize: (content) => (content.kind === "channel" ? content.id : ""),
      },
      view: ConversationView,
    },
    { order: 100 },
  );
  ctx.add(
    "shell.pane",
    {
      primary: true,
      kind: "dm",
      size: 0.5,
      singleton: false,
      tabLabel,
      url: { parse: () => null, serialize: (content) => (content.kind === "dm" ? content.id : "") },
      view: ConversationView,
    },
    { order: 101 },
  );
  const loadedMessage = (channelId: string, ts: string) =>
    messages.findAllMessageLocations(channelId, ts)[0]?.list.find((m) => m.ts === ts);
  ctx.add("message-links.loaded", (channelId, ts) => !!loadedMessage(channelId, ts));
  const blockKitResolver = createBlockKitResolver(ctx.use("messages.blockKit"));
  ctx.add("shell.provider", (props) => (
    <BlockKitResolverContext.Provider value={blockKitResolver}>
      {props.children}
    </BlockKitResolverContext.Provider>
  ));
  ctx.add("messages.blockKit", {
    wrapLink: (url, trigger, attachments) => {
      const target = parseSlackPermalink(url);
      if (!target) return trigger;
      const unfurl = attachments?.find((a) => a.isMessageUnfurl && a.ts === target.messageTs);
      const loaded = loadedMessage(target.channelId, target.messageTs);
      const knownPreview = unfurl
        ? attachmentToHoverPreview(unfurl)
        : loaded && messageToHoverPreview(loaded);
      return (
        <MessageLinkHoverCard
          channelId={target.channelId}
          knownPreview={knownPreview}
          messageTs={target.messageTs}
          threadTs={target.threadTs}
        >
          {trigger}
        </MessageLinkHoverCard>
      );
    },
  });
  const [lastOpened, setLastOpened] = createSignal<string>();
  ctx.add("conversations.opened", (view) => setLastOpened(view.id));
  ctx.add("blockkit.entitySource", createEntitySource(lastOpened));
  ctx.add("messages.channelMenu", MarkReadItem, { order: 0 });
  ctx.add("messages.bar", liveOnly(EditButton), { order: 0 });
  ctx.add("messages.body", FeedbackBody, { order: 30 });
  ctx.add("messages.menu", liveOnly(EditItem), { order: 0 });
  ctx.add("messages.menu", liveOnly(MarkUnreadItem), { order: 50 });
  ctx.add("messages.menu", CopyTextItem, { order: 60 });
  ctx.add("messages.menu", DeleteItem, { order: 100 });
};

export default setup;
