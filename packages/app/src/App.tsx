import type { BlockKitResolver } from "@slock/blockkit";
import { BlockKitResolverContext } from "@slock/blockkit";
import {
  Button,
  ConfirmDialogHost,
  ConnectionStatus,
  DebugInfoDialogHost,
  InlineFeedback,
  PaneRow,
  useGlobalUndoShortcut,
  usePaneNavigation,
} from "@slock/ui";
import { createEffect, onCleanup, onMount, Show } from "solid-js";
import ChannelDetails from "./components/channel/channel-details/ChannelDetails";
import ChannelHoverCard from "./components/channel/channel-details/ChannelHoverCard";
import ContextActions from "./components/context-actions/ContextActions";
import MessageLinkHoverCard from "./components/messages/parts/MessageLinkHoverCard";
import ViewModal from "./components/modals/ViewModal";
import { openConversationInSplit, SplitNavigation } from "./components/navigation/SplitNavigation";
import PaneSwitch from "./components/panes/PaneSwitch";
import Sidebar from "./components/sidebar/Sidebar";
import UserHoverCard from "./components/user/UserHoverCard";
import UsergroupHoverCard from "./components/usergroup/UsergroupHoverCard";
import { fetchPermalinkMessage } from "./lib/api";
import { channelDisplayName, conversationDisplayName, dmDisplayName } from "./lib/displayName";
import { actionFeedback } from "./lib/feedback";
import { handleMessageCopy } from "./lib/messageCopy";
import {
  createSlackPermalinkOpener,
  navigateToSlackPermalink,
  parseSlackPermalink,
} from "./lib/navigation/slackPermalink";
import { store } from "./lib/store";
import { undoStack } from "./lib/undo";
import { openUsergroupDetails } from "./lib/usergroupDetails";

const blockKitResolver: BlockKitResolver = {
  onCanvasClick: (fileId, title) => store.canvas.openCanvasPane(fileId, title ?? "canvas"),
  onChannelClick: (id) => store.viewState.setActiveView({ id, kind: "channel" }),
  onUserClick: store.users.openUserProfile,
  onUsergroupClick: openUsergroupDetails,
  resolveChannel: (id) => {
    const channel = store.channels.channelById(id);
    if (channel) {
      return {
        isMember: store.channels.isChannelMember(id),
        isPrivate: channel.private,
        name: channelDisplayName(channel),
      };
    }
    const dm = store.dms.dmById(id);
    return dm
      ? { isMember: true, isPrivate: true, name: dmDisplayName(dm, store.users.userById) || id }
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

function App() {
  usePaneNavigation();
  useGlobalUndoShortcut(undoStack, (label) => actionFeedback.flash("undo", `Undid: ${label}`));

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
            store.channels.channelById,
            store.dms.dmById,
            store.users.userById,
          )
        : "") ||
      "slock";
  });

  const permalinkOpener = createSlackPermalinkOpener({
    navigate: (target, options) => navigateToSlackPermalink(target, store.viewState, options),
    onError: (error) => {
      console.error("Failed to open Slack permalink", error);
      actionFeedback.flash("navigation", "Couldn't open that message. Try again.", "error");
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

    const nav = store.viewState.nav();
    const keepNav = nav === "later" || nav === "activity";
    void permalinkOpener.open(target, { keepNav });
  };

  onMount(() => {
    document.addEventListener("click", openSlackPermalink);
    document.addEventListener("copy", handleMessageCopy);
    onCleanup(() => {
      permalinkOpener.invalidate();
      document.removeEventListener("click", openSlackPermalink);
      document.removeEventListener("copy", handleMessageCopy);
    });
  });

  return (
    <BlockKitResolverContext.Provider value={blockKitResolver}>
      <Show
        fallback={
          <main class="app-bootstrap-error flex-center flex-col">
            <h1>Couldn't load your workspace</h1>
            <p>Check your connection and try again.</p>
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
            priority={1}
          />
          <Sidebar />

          <PaneRow
            onResize={store.panes.resize}
            panes={store.panes.panes()}
            renderPane={(pane) => <PaneSwitch pane={pane} />}
          />
          <ContextActions />
          <ViewModal />
          <ChannelDetails />
          <ConfirmDialogHost />
          <DebugInfoDialogHost />
        </div>
      </Show>
    </BlockKitResolverContext.Provider>
  );
}

export default App;
