import { Slot, service, usePoint } from "@slock/core/solid";
import {
  ConfirmDialog,
  InlineFeedback,
  useCloseShortcut,
  useFieldCommitShortcut,
  useGlobalUndoShortcut,
  usePaneNavigation,
} from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { dynamic } from "@solidjs/web";
import { createMemo, Show } from "solid-js";
import "./App.css";
import PaneSwitch, { paneTabLabel } from "./PaneSwitch";

const feedback = service("feedback");
const panesStore = service("shell.panes");
const viewStore = service("shell.view");
const layout = service("shell.layout");
const dialogs = service("shell.dialogs");

function Providers(props: { children: JSX.Element }) {
  const providers = usePoint("shell.provider");
  const wrap = (index: number): JSX.Element => {
    const Provider = providers()[index];
    return Provider ? <Provider>{wrap(index + 1)}</Provider> : props.children;
  };
  return <>{wrap(0)}</>;
}

export default function App() {
  useCloseShortcut();
  useFieldCommitShortcut();
  usePaneNavigation();
  useGlobalUndoShortcut(feedback.undo, (label) => feedback.flash("undo", `Undid: ${label}`));

  const blockers = usePoint("shell.blocker");
  const blocker = createMemo(() => blockers().find((item) => item.active()));
  const arrangements = usePoint("shell.arrangement");
  const Blocker = dynamic(() => blocker()?.view);
  const Arrangement = dynamic(() => arrangements()[0]?.view);

  return (
    <Providers>
      <ConfirmDialog dialog={dialogs} />
      <Show fallback={<Blocker />} when={!blocker()}>
        <div class="app">
          <InlineFeedback
            class="app-navigation-feedback surface-popover"
            feedback={feedback.get("navigation")}
            priority={2}
          />
          <InlineFeedback
            class="app-navigation-feedback surface-popover"
            feedback={feedback.get("undo")}
            priority={1}
          />
          <Slot point="shell.start" />
          <Arrangement
            activePaneId={panesStore.activePaneId}
            containerWidth={() => layout.windowWidth() - layout.startWidth()}
            onActivate={panesStore.activatePane}
            onCloseTab={(pane) => viewStore.closeTile(pane.id)}
            onResize={panesStore.resize}
            panes={panesStore.panes()}
            renderPane={(pane) => <PaneSwitch pane={pane} />}
            tabLabel={paneTabLabel}
          />
          <Slot point="shell.overlay" />
        </div>
      </Show>
    </Providers>
  );
}
