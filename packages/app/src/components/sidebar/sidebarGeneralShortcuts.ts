import { useShortcut } from "@slock/ui";
import type { Accessor, Setter } from "solid-js";
import { store } from "../../lib/store";
import type { SettingsTab } from "../settings/Settings";

export function useSidebarGeneralShortcuts(props: {
  setSearchOpen: Setter<boolean>;
  setSettingsOpen: Setter<boolean>;
  setSettingsTab: Setter<SettingsTab>;
  setUnreadsOnly: Setter<boolean>;
  unreadsOnly: Accessor<boolean>;
}) {
  useShortcut({
    allowInInputs: true,
    combo: { key: "k", mod: true },
    handler: () => props.setSearchOpen(true),
    id: "sidebar.quickSwitcher",
    label: "Quick Switcher",
    group: "Channels and search",
    scope: "general",
  });
  useShortcut({
    allowInInputs: true,
    allowRepeat: false,
    combo: { key: "g", mod: true },
    handler: () => store.viewState.openMessageSearch(""),
    id: "sidebar.searchMessages",
    label: "Search all messages",
    group: "Channels and search",
    scope: "general",
  });
  useShortcut({
    allowInInputs: true,
    allowRepeat: false,
    combo: { key: "/", mod: true },
    handler: () => {
      props.setSettingsTab("keybinds");
      props.setSettingsOpen(true);
    },
    id: "general.showShortcuts",
    label: "Open keybind settings",
    group: "App",
    scope: "general",
  });
  useShortcut({
    combo: { key: "u", shift: true },
    enabled: () => !props.unreadsOnly(),
    handler: () => {
      store.viewState.setNavView("home");
      props.setUnreadsOnly(true);
    },
    id: "sidebar.unreadsOnly",
    label: "Show unread channels only",
    group: "Channels and search",
    scope: "general",
  });
}
