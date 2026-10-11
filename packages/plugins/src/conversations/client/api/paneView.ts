import { createContext, useContext } from "solid-js";
import type { ChannelMessageTarget, View } from "./types";

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
