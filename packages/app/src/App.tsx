import type { BlockKitResolver } from "@slock/blockkit";
import { BlockKitResolverContext } from "@slock/blockkit";
import { fetchPermalinkMessage } from "@slock/slack-api";
import {
  Button,
  ConnectionStatus,
  InlineFeedback,
  TileGroup,
  type TileLeaf,
  TypingIndicator,
} from "@slock/ui";
import { createEffect, createMemo, onCleanup, onMount, Show } from "solid-js";
import ArchivedChannelBar from "./components/channel/ArchivedChannelBar";
import CanvasPanel from "./components/channel/CanvasPanel";
import ChannelHeader from "./components/channel/ChannelHeader";
import ChannelDetails from "./components/channel/channel-details/ChannelDetails";
import ChannelHoverCard from "./components/channel/channel-details/ChannelHoverCard";
import { createChannelHeaderState } from "./components/channel/channelHeaderState";
import JoinChannelBar from "./components/channel/JoinChannelBar";
import PinnedPanel from "./components/channel/PinnedPanel";
import Composer from "./components/composer/Composer";
import ContextActions from "./components/context-actions/ContextActions";
import MessageList from "./components/messages/MessageList";
import MessageLinkHoverCard from "./components/messages/parts/MessageLinkHoverCard";
import ThreadPanel from "./components/messages/thread/ThreadPanel";
import ViewModal from "./components/modals/ViewModal";
import { openConversationInSplit, SplitNavigation } from "./components/navigation/SplitNavigation";
import Sidebar from "./components/sidebar/Sidebar";
import UserHoverCard from "./components/user/UserHoverCard";
import UserProfile from "./components/user/UserProfile";
import UsergroupDetails from "./components/usergroup/UsergroupDetails";
import UsergroupHoverCard from "./components/usergroup/UsergroupHoverCard";
import { handleMessageCopy } from "./lib/messageCopy";
import { installMessageHoverDragGuard } from "./lib/messageHoverDragGuard";
import {
  createSlackPermalinkOpener,
  navigateToSlackPermalink,
  parseSlackPermalink,
} from "./lib/navigation/slackPermalink";
import { PaneViewProvider } from "./lib/paneView";
import { actionFeedback, channelDisplayName, conversationDisplayName, store } from "./lib/store";
import type { View } from "./lib/store/slices/types";
import { openUsergroupDetails } from "./lib/usergroupDetails";

const blockKitResolver: BlockKitResolver = {
  onChannelClick: (id) => store.viewState.setActiveView({ id, kind: "channel" }),
  onUserClick: store.users.openUserProfile,
  onUsergroupClick: openUsergroupDetails,
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
  resolveUsergroup: (id) => {
    const usergroup = store.usergroups.usergroupById(id);
    return usergroup
      ? { isSelf: store.usergroups.isSelfMember(id), name: usergroup.name }
      : undefined;
  },
  wrapChannelMention: (id, trigger) => (
    <SplitNavigation onSplit={() => openConversationInSplit(id)}>
      <ChannelHoverCard channelId={id}>{trigger}</ChannelHoverCard>
    </SplitNavigation>
  ),
  wrapLink: (url, trigger) => {
    const target = parseSlackPermalink(url);
    return target ? (
      <SplitNavigation onSplit={() => openConversationInSplit(target.channelId, target.threadTs)}>
        <MessageLinkHoverCard
          channelId={target.channelId}
          messageTs={target.messageTs}
          threadTs={target.threadTs}
        >
          {trigger}
        </MessageLinkHoverCard>
      </SplitNavigation>
    ) : (
      trigger
    );
  },
  wrapUserMention: (id, trigger) => <UserHoverCard userId={id}>{trigger}</UserHoverCard>,
  wrapUsergroupMention: (id, trigger) => (
    <UsergroupHoverCard usergroupId={id}>{trigger}</UsergroupHoverCard>
  ),
};

function MainPane(props: { leaf: TileLeaf<View | null> }) {
  const { isArchivedChannel } = createChannelHeaderState(() => props.leaf.content);
  const unjoinedChannelId = () => {
    const view = props.leaf.content;
    return view?.kind === "channel" && !store.channels.isChannelMember(view.id)
      ? view.id
      : undefined;
  };
  const typingNames = createMemo(() => {
    const view = props.leaf.content;
    return view ? store.typing.typingUsersInChannel(view.id).map((user) => user.name) : [];
  });

  return (
    <PaneViewProvider
      value={{
        clearMessageTarget: () => store.tiling.clearMessageTarget(props.leaf.id),
        messageTarget: () => store.tiling.messageTarget(props.leaf.id),
        paneId: props.leaf.id,
        view: () => props.leaf.content,
      }}
    >
      <div class="main-panel">
        <ChannelHeader />
        <MessageList />
        <Show
          fallback={
            <Show
              fallback={
                <div class="typing-indicator-anchor">
                  <TypingIndicator names={typingNames()} />
                  <Composer channelId={props.leaf.content?.id} />
                </div>
              }
              when={isArchivedChannel()}
            >
              <ArchivedChannelBar />
            </Show>
          }
          when={unjoinedChannelId()}
        >
          {(channelId) => <JoinChannelBar channelId={channelId()} />}
        </Show>
      </div>
    </PaneViewProvider>
  );
}

function App() {
  createEffect(() => {
    const nav = store.viewState.nav();
    const view = store.viewState.activeView();
    document.title =
      {
        activity: "Activity",
        later: "Later",
        search: "Search",
      }[nav] ||
      (view
        ? conversationDisplayName(
            view.id,
            view.kind === "channel" ? store.channels.channelById(view.id) : undefined,
            view.kind === "dm" ? store.dms.dmById(view.id) : undefined,
            store.users.userById,
          )
        : "") ||
      "slock";
  });

  const permalinkOpener = createSlackPermalinkOpener({
    navigate: (target, options) => navigateToSlackPermalink(target, store.viewState, options),
    onError: (error) => {
      console.error("Failed to open Slack permalink", error);
      actionFeedback.flash("navigation", "Couldn’t open that message. Try again.", "error");
    },
    onUnavailable: () =>
      actionFeedback.flash("navigation", "That message is unavailable.", "error"),
    probe: async (target) =>
      !!(await fetchPermalinkMessage(target.channelId, target.messageTs, target.threadTs)),
  });

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

    permalinkOpener.invalidate();

    const element = event.target instanceof Element ? event.target : null;
    const anchor = element?.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;

    const target = parseSlackPermalink(anchor.href);
    if (!target) return;

    event.preventDefault();
    actionFeedback.clear("navigation");
    // Probe the message before navigating — a link to a channel we can't read
    // (private, not a member) would otherwise switch views only to land on a
    // dead end. A newer primary click invalidates this probe so a slow response
    // cannot unexpectedly pull the user away from their newer destination.
    const nav = store.viewState.nav();
    const keepNav = nav === "later" || nav === "activity";
    void permalinkOpener.open(target, { keepNav });
  };

  onMount(() => {
    document.addEventListener("click", openSlackPermalink);
    document.addEventListener("copy", handleMessageCopy);
    const uninstallDragGuard = installMessageHoverDragGuard();
    onCleanup(() => {
      permalinkOpener.invalidate();
      document.removeEventListener("click", openSlackPermalink);
      document.removeEventListener("copy", handleMessageCopy);
      uninstallDragGuard();
    });
  });

  function renderMainPaneContent(leaf: TileLeaf<View | null>) {
    return <MainPane leaf={leaf} />;
  }

  return (
    <BlockKitResolverContext.Provider value={blockKitResolver}>
      <Show
        fallback={
          <main class="app-bootstrap-error flex-center flex-col" role="alert">
            <h1>Couldn’t load your workspace</h1>
            <p>Check your connection and try again. Your local settings are unchanged.</p>
            <Button
              disabled={store.resources.bootstrap.loading}
              onClick={() => void store.resources.retryBootstrap()}
              variant="primary"
            >
              {store.resources.bootstrap.loading ? "Retrying…" : "Try again"}
            </Button>
          </main>
        }
        when={!store.resources.bootstrap.error}
      >
        <ConnectionStatus
          onRetry={store.realtime.retryConnection}
          state={store.realtime.connectionState()}
        />
        <div class="app">
          <InlineFeedback
            class="app-navigation-feedback"
            feedback={actionFeedback.get("navigation")}
            priority={2}
          />
          <Sidebar />

          <TileGroup
            onResize={store.tiling.resizeSplit}
            renderLeaf={renderMainPaneContent}
            tree={store.tiling.tree()}
          />
          <ThreadPanel />
          <UserProfile />
          <UsergroupDetails />
          <ChannelDetails />
          <PinnedPanel />
          <CanvasPanel />
          <ContextActions />
          <ViewModal />
        </div>
      </Show>
    </BlockKitResolverContext.Provider>
  );
}

export default App;
