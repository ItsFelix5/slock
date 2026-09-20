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
  windowWidth,
} from "@slock/ui";
import { QueryClientProvider } from "@tanstack/solid-query";
import { createEffect, lazy, Show } from "solid-js";
import { blockKitRenderResolver } from "./components/blockKitRender";
import PaneSwitch, { paneTabLabel } from "./components/panes/PaneSwitch";
import Sidebar, { sidebarWidth } from "./components/sidebar/Sidebar";
import { blockKitDataResolver } from "./lib/blockKitResolver";
import { conversationDisplayName } from "./lib/displayName";
import { actionFeedback, undoStack } from "./lib/feedback";
import { useSlackPermalinkHandler } from "./lib/navigation/useSlackPermalinkHandler";
import { queryClient, store } from "./lib/store";

const ChannelDetails = lazy(() => import("./components/channel/channel-details/ChannelDetails"));
const ViewModal = lazy(() => import("./components/modals/ViewModal"));

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
    <QueryClientProvider client={queryClient}>
      <BlockKitResolverContext.Provider
        value={{ ...blockKitDataResolver, ...blockKitRenderResolver }}
      >
        <Show
          fallback={
            <main class="app-bootstrap-error flex-center flex-col">
              <h1>Couldn't load your workspace</h1>
              <p>Check your connection and try again.</p>
              <Button
                disabled={store.resources.bootstrap.isFetching}
                onClick={() => void store.resources.retryBootstrap()}
                variant="primary"
              >
                {store.resources.bootstrap.isFetching ? "Retrying…" : "Try again"}
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
              activePaneId={store.panes.activePaneId}
              containerWidth={() => windowWidth() - sidebarWidth()}
              onActivate={store.panes.activatePane}
              onCloseTab={(pane) => store.viewState.closeTile(pane.id)}
              onResize={store.panes.resize}
              panes={store.panes.panes()}
              renderPane={(pane) => <PaneSwitch pane={pane} />}
              tabLabel={paneTabLabel}
            />

            <ViewModal />
            <ChannelDetails />
            <ConfirmDialogHost />
            <DebugInfoDialogHost />
          </div>
        </Show>
      </BlockKitResolverContext.Provider>
    </QueryClientProvider>
  );
}

export default App;
