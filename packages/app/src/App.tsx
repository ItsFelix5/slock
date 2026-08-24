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
import { createEffect, Show } from "solid-js";
import ChannelDetails from "./components/channel/channel-details/ChannelDetails";
import ContextActions from "./components/context-actions/ContextActions";
import ViewModal from "./components/modals/ViewModal";
import SplitDropZone from "./components/navigation/SplitDropZone";
import PaneSwitch, { paneTabLabel } from "./components/panes/PaneSwitch";
import Sidebar from "./components/sidebar/Sidebar";
import { blockKitResolver } from "./lib/blockKitResolver";
import { conversationDisplayName } from "./lib/displayName";
import { actionFeedback } from "./lib/feedback";
import { useSlackPermalinkHandler } from "./lib/navigation/useSlackPermalinkHandler";
import { store } from "./lib/store";
import { undoStack } from "./lib/undo";

function App() {
  usePaneNavigation();
  useGlobalUndoShortcut(undoStack, (label) => actionFeedback.flash("undo", `Undid: ${label}`));
  useSlackPermalinkHandler();

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
            tabLabel={paneTabLabel}
          />

          <ContextActions />
          <SplitDropZone />
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
