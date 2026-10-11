import type { Component } from "solid-js";
import type { createSidebarStore } from "./store";

export type SidebarNavItem = {
  id: string;
  label: string;
  button: Component<{ active: boolean }>;
  view: Component;
  feed?: boolean;
  hidden?: boolean;
  select?: (active: boolean) => void;
};

declare module "@slock/core/types" {
  interface Points {
    "sidebar.nav": SidebarNavItem;
    "sidebar.toolbar": Component;
  }
  interface Services {
    sidebar: ReturnType<typeof createSidebarStore>;
  }
}
