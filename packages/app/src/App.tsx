import type { BlockKitResolver } from "@slock/blockkit";
import { BlockKitResolverContext } from "@slock/blockkit";
import { TypingIndicator } from "@slock/ui";
import { createMemo, onCleanup, onMount, Show } from "solid-js";
import CanvasPanel from "./components/channel/CanvasPanel";
import ChannelHeader from "./components/channel/ChannelHeader";
import ChannelDetails from "./components/channel/channel-details/ChannelDetails";
import ChannelHoverCard from "./components/channel/channel-details/ChannelHoverCard";
import JoinChannelBar from "./components/channel/JoinChannelBar";
import PinnedPanel from "./components/channel/PinnedPanel";
import Composer from "./components/composer/Composer";
import ContextActions from "./components/context-actions/ContextActions";
import MessageList from "./components/messages/MessageList";
import MessageLinkHoverCard from "./components/messages/parts/MessageLinkHoverCard";
import ThreadPanel from "./components/messages/ThreadPanel";
import MessageSearchView from "./components/search/MessageSearchView";
import Sidebar from "./components/sidebar/Sidebar";
import UserHoverCard from "./components/user/UserHoverCard";
import UserProfile from "./components/user/UserProfile";
import { parseSlackPermalink } from "./lib/slackPermalink";
import { channelDisplayName, store } from "./lib/store";

const blockKitResolver: BlockKitResolver = {
  onChannelClick: (id) => store.viewState.setActiveView({ id, kind: "channel" }),
  onUserClick: store.users.openUserProfile,
  resolveChannel: (id) => {
    const channel = store.channels.channelById(id);
    return channel
      ? {
          isMember: store.channels.isChannelMember(id),
          isPrivate: channel.private,
          name: channelDisplayName(channel),
        }
      : undefined;
  },
  resolveUser: (id) => {
    const user = store.users.userById(id);
    return user ? { isSelf: id === store.users.currentUser()?.id, name: user.name } : undefined;
  },
  resolveUsergroup: (id) => store.usergroups.usergroupById(id),
  wrapChannelMention: (id, trigger) => (
    <ChannelHoverCard channelId={id}>{trigger}</ChannelHoverCard>
  ),
  wrapLink: (url, trigger) => {
    const target = parseSlackPermalink(url);
    return target ? (
      <MessageLinkHoverCard
        channelId={target.channelId}
        messageTs={target.messageTs}
        threadTs={target.threadTs}
      >
        {trigger}
      </MessageLinkHoverCard>
    ) : (
      trigger
    );
  },
  wrapUserMention: (id, trigger) => <UserHoverCard userId={id}>{trigger}</UserHoverCard>,
};

function App() {
  const openSlackPermalink = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;

    const element = event.target instanceof Element ? event.target : null;
    const anchor = element?.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;

    const target = parseSlackPermalink(anchor.href);
    if (!target) return;

    event.preventDefault();
    store.viewState.setActiveView({ id: target.channelId, kind: "channel" });
    store.viewState.openThread(target.channelId, target.threadTs);
  };

  onMount(() => {
    document.addEventListener("click", openSlackPermalink);
    onCleanup(() => document.removeEventListener("click", openSlackPermalink));
  });

  const unjoinedChannelId = () => {
    if (store.resources.bootstrap.loading) return;
    const v = store.viewState.activeView();
    return v?.kind === "channel" && !store.channels.isChannelMember(v.id) ? v.id : undefined;
  };

  const typingNames = createMemo(() => {
    const v = store.viewState.activeView();
    if (!v) return [];
    return store.typing.typingUsersInChannel(v.id).map((u) => u.name);
  });

  return (
    <BlockKitResolverContext.Provider value={blockKitResolver}>
      <div class="app">
        <Show when={store.resources.bootstrap.error}>
          <div class="app-bootstrap-error">
            Failed to load: {String(store.resources.bootstrap.error)}
          </div>
        </Show>
        <Sidebar />

        <div class="main-panel">
          <Show fallback={<MessageSearchView />} when={store.viewState.nav() !== "search"}>
            <ChannelHeader />
            <MessageList />
            <TypingIndicator names={typingNames()} />
            <Show fallback={<Composer />} when={unjoinedChannelId()}>
              {(channelId) => <JoinChannelBar channelId={channelId()} />}
            </Show>
          </Show>
        </div>
        <ThreadPanel />
        <UserProfile />
        <ChannelDetails />
        <PinnedPanel />
        <CanvasPanel />
        <ContextActions />
      </div>
    </BlockKitResolverContext.Provider>
  );
}

export default App;
