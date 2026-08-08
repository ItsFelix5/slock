import type { BlockKitResolver } from "@slock/blockkit";
import { BlockKitResolverContext } from "@slock/blockkit";
import { fetchPermalinkMessage } from "@slock/slack-api";
import { Button, ConnectionStatus, InlineFeedback, TypingIndicator, useShortcut } from "@slock/ui";
import { createEffect, createMemo, onCleanup, onMount, Show } from "solid-js";
import ArchivedChannelBar from "./components/channel/ArchivedChannelBar";
import CanvasPanel from "./components/channel/CanvasPanel";
import ChannelHeader from "./components/channel/ChannelHeader";
import ChannelDetails from "./components/channel/channel-details/ChannelDetails";
import ChannelHoverCard from "./components/channel/channel-details/ChannelHoverCard";
import { isArchivedChannel } from "./components/channel/channelHeaderState";
import JoinChannelBar from "./components/channel/JoinChannelBar";
import PinnedPanel from "./components/channel/PinnedPanel";
import Composer from "./components/composer/Composer";
import ContextActions from "./components/context-actions/ContextActions";
import MessageList from "./components/messages/MessageList";
import MessageLinkHoverCard from "./components/messages/parts/MessageLinkHoverCard";
import ThreadPanel from "./components/messages/thread/ThreadPanel";
import ViewModal from "./components/modals/ViewModal";
import Sidebar from "./components/sidebar/Sidebar";
import UserHoverCard from "./components/user/UserHoverCard";
import UserProfile from "./components/user/UserProfile";
import UsergroupDetails from "./components/usergroup/UsergroupDetails";
import UsergroupHoverCard from "./components/usergroup/UsergroupHoverCard";
import {
  createSlackPermalinkOpener,
  navigateToSlackPermalink,
  parseSlackPermalink,
} from "./lib/navigation/slackPermalink";
import { actionFeedback, channelDisplayName, conversationDisplayName, store } from "./lib/store";
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
  wrapUsergroupMention: (id, trigger) => (
    <UsergroupHoverCard usergroupId={id}>{trigger}</UsergroupHoverCard>
  ),
};

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
    onCleanup(() => {
      permalinkOpener.invalidate();
      document.removeEventListener("click", openSlackPermalink);
    });
  });

  // Covers whichever of pin/mute/save-for-later happened most recently — each
  // of those is its own clean inverse already, so "undo" is just calling the
  // same toggle again. Not allowed while typing (unset allowInInputs), so it
  // never steals the composer's own native text-undo.
  useShortcut({
    allowRepeat: false,
    enabled: () => !!store.undo.lastAction(),
    handler: () => {
      const action = store.undo.lastAction();
      store.undo.undoLastAction();
      if (action) actionFeedback.flash("undo", `Undone — ${action.label}`);
    },
    keys: "Ctrl/⌘ Z",
    label: "Undo the last pin, mute, or save-for-later",
    match: (e) =>
      (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "z",
    scope: "general",
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
          <InlineFeedback
            class="app-navigation-feedback"
            feedback={actionFeedback.get("undo")}
            priority={2}
          />
          <Sidebar />

          <div class="main-panel">
            <ChannelHeader />
            <MessageList />
            <Show
              fallback={
                <Show
                  fallback={
                    <div class="typing-indicator-anchor">
                      <TypingIndicator names={typingNames()} />
                      <Composer />
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
