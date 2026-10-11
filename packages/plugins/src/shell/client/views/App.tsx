import { Slot, service, usePoint } from "@slock/core/solid";
import {
  ConfirmDialog,
  InlineFeedback,
  PaneRow,
  useCloseShortcut,
  useFieldCommitShortcut,
  useGlobalUndoShortcut,
  usePaneNavigation,
  windowWidth,
} from "@slock/ui";
import { createMemo, type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import "./App.css";
import PaneSwitch, { paneTabLabel } from "./PaneSwitch";

const feedback = service("feedback");
const panesStore = service("shell.panes");
const viewStore = service("shell.view");
const layout = service("shell.layout");

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

  return (
    <Providers>
      <ConfirmDialog />
      <Show fallback={<Dynamic component={blocker()?.view} />} when={!blocker()}>
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
          <PaneRow
            activePaneId={panesStore.activePaneId}
            containerWidth={() => windowWidth() - layout.startWidth()}
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
