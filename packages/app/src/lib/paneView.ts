import { createContext, useContext } from "solid-js";
import type { ChannelMessageTarget, View } from "./store/slices/types";

// Gives components that render channel content (MessageList, ChannelHeader,
// the composer) an identity independent of the global "active view" singleton,
// so a tile pane can show a channel other than whichever one drives the URL.
// No fallback to the old global signal on purpose: a stray read outside a
// provider should fail loudly at dev time instead of silently rendering the
// wrong pane's content once more than one pane exists.
export interface PaneViewContextValue {
  clearMessageTarget: () => void;
  messageTarget: () => ChannelMessageTarget | null;
  paneId: string;
  view: () => View | null;
}

const PaneViewContext = createContext<PaneViewContextValue>();

export const PaneViewProvider = PaneViewContext.Provider;

export function usePaneView(): PaneViewContextValue {
  const value = useContext(PaneViewContext);
  if (!value) throw new Error("usePaneView() called with no PaneViewContext.Provider above it");
  return value;
}
