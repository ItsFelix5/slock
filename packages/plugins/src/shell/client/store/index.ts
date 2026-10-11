import type { PaneKind } from "../api";
import type { PaneContent } from "../api/types";
import { createAppActions } from "./actions";
import { createPanesSlice } from "./panes";
import { createViewStateSlice } from "./viewState";

export function createShellStore(deps: {
  defaultView: () => PaneContent | undefined;
  paneKinds: () => PaneKind[];
  ready: () => boolean;
}) {
  const panes = createPanesSlice(deps.paneKinds);
  const viewState = createViewStateSlice({
    defaultView: deps.defaultView,
    paneKinds: deps.paneKinds,
    panes,
    ready: deps.ready,
  });
  return { panes, viewState: { ...viewState, ...createAppActions(panes) } };
}
