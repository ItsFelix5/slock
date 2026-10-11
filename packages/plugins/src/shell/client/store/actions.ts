import type { PaneContent } from "../api/types";
import type { createPanesSlice } from "./panes";

export function createAppActions(panes: ReturnType<typeof createPanesSlice>) {
  return {
    canCloseTile: () => panes.panes().length > 1,
    closeTile: panes.closePane,
    open: (content: PaneContent) => panes.navigateFocusedPane(content),
  };
}
