import { createContext, useContext } from "solid-js";
import type { ChannelMessageTarget, View } from "./types";

export interface PaneViewContextValue {
  clearMessageTarget: () => void;
  messageTarget: () => ChannelMessageTarget | null;
  paneId: string;
  view: () => View | null;
}

const PaneViewContext = createContext<PaneViewContextValue>();

export const PaneViewProvider = PaneViewContext;

export function usePaneView(): PaneViewContextValue {
  return useContext(PaneViewContext);
}
